#!/usr/bin/env python3
"""
align_cli.py — STANDALONE FASTER-WHISPER ALIGNMENT PIPELINE
============================================================
Menggunakan standalone faster-whisper dengan Silero VAD & Word-Level Timestamps.
Mendeteksi fisik suara narator secara presisi dari audio, lalu mencocokkan
naskah asli (Step 2) agar teks 100% akurat tanpa typo ASR.

Usage:
  PYTHONSAFEPATH=1 venv/bin/python align_cli.py \
    --audio <path.wav> \
    --text <path_to_script_txt_or_json> \
    --output <out.json> \
    --model medium \
    --device cpu
"""
import argparse
import difflib
import json
import os
import re
import sys
import time


def log(msg):
    print(f"[faster-whisper] {msg}", file=sys.stderr, flush=True)


def get_audio_duration(audio_path: str) -> float:
    import subprocess
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True)
    try:
        return float(proc.stdout.strip())
    except ValueError:
        return 0.0


def load_narration_text(text_path: str) -> str:
    """Load teks narasi dari file .txt atau JSON (analysis/transcript format)."""
    if not os.path.exists(text_path):
        raise FileNotFoundError(text_path)
    if text_path.endswith(".json"):
        with open(text_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            naskah = data.get("naskah_voiceover") or data.get("script") or {}
            if isinstance(naskah, dict):
                return naskah.get("script_text") or naskah.get("text") or ""
            if isinstance(naskah, str):
                return naskah
            for key in ("script_text", "transcript_full", "text", "naskah"):
                if key in data and isinstance(data[key], str):
                    return data[key]
        elif isinstance(data, list):
            texts = [item.get("text") for item in data if isinstance(item, dict) and item.get("text")]
            if texts:
                return " ".join(texts)
        raise ValueError(f"Tidak bisa ekstrak teks narasi dari {text_path}")
    with open(text_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def split_sentences(text: str) -> list:
    """Pecah teks naskah jadi array kalimat."""
    sentences = re.split(r"(?<=[.!?…])\s+", text.strip())
    return [s.strip() for s in sentences if s.strip()]


def format_minute(sec: float) -> str:
    m = int(sec // 60)
    s = int(sec % 60)
    return f"{m:02d}:{s:02d}"


def run_faster_whisper_pipeline(audio_path: str, raw_text: str, model_name: str = "small", device: str = "cpu") -> list:
    import os
    from faster_whisper import WhisperModel

    threads = min(8, os.cpu_count() or 4)
    compute_type = "int8" if device == "cpu" else "float16"

    log(f"🧠 [1/4] Checking local cache for model '{model_name}'...")
    log(f"⚡ [2/4] Initializing CTranslate2 engine with {threads} CPU threads & 2 workers ({compute_type})...")
    
    t_load_start = time.time()
    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        cpu_threads=threads,
        num_workers=2
    )
    t_load_dur = time.time() - t_load_start
    log(f"✅ [3/4] Loaded Faster-Whisper model '{model_name}' into RAM in {t_load_dur:.2f}s!")

    audio_dur = get_audio_duration(audio_path)
    log(f"🎙️ [4/4] Audio Target: {os.path.basename(audio_path)} (Total: {format_minute(audio_dur)} / {audio_dur:.1f}s)")
    log(f"🚀 Starting Silero VAD & Faster-Whisper live audio transcription...")

    start_t = time.time()
    segments_gen, info = model.transcribe(
        audio_path,
        language="id",
        beam_size=1,
        best_of=1,
        condition_on_previous_text=False,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400),
        word_timestamps=True
    )

    fw_segments = []
    for seg in segments_gen:
        fw_segments.append(seg)
        pct = min(99, int((seg.end / audio_dur) * 100)) if audio_dur > 0 else 0
        t_start = format_minute(seg.start)
        t_end = format_minute(seg.end)
        txt = seg.text.strip()
        if len(txt) > 42:
            txt = txt[:39] + "..."
        log(f"🎙️ [{pct}%] Segmen #{len(fw_segments)} [{t_start} - {t_end}]: \"{txt}\"")

    log(f"✨ Selesai VAD Transcribe dalam {time.time() - start_t:.1f}s. Terdeteksi {len(fw_segments)} segmen audio fisik.")

    sentences = split_sentences(raw_text)
    log(f"🔍 Perform Fuzzy Text-Matching Alignment: {len(sentences)} kalimat ke kata-kata audio fisik...")

    # Extract all physical words with exact timestamps
    all_words = []
    for seg in fw_segments:
        if hasattr(seg, "words") and seg.words:
            for w in seg.words:
                cleaned_word = re.sub(r'[^\w\s]', '', w.word.strip().lower())
                if cleaned_word:
                    all_words.append({
                        "text": cleaned_word,
                        "raw": w.word.strip(),
                        "start": float(w.start),
                        "end": float(w.end)
                    })
        else:
            words_in_seg = seg.text.strip().split()
            if words_in_seg:
                dur_per_word = (seg.end - seg.start) / len(words_in_seg)
                for idx, w_raw in enumerate(words_in_seg):
                    c_word = re.sub(r'[^\w\s]', '', w_raw.lower())
                    if c_word:
                        all_words.append({
                            "text": c_word,
                            "raw": w_raw,
                            "start": float(seg.start + idx * dur_per_word),
                            "end": float(seg.start + (idx + 1) * dur_per_word)
                        })

    entries = []
    n_sent = len(sentences)
    total_words = len(all_words)

    if n_sent == 0 or total_words == 0:
        for idx, seg in enumerate(fw_segments, start=1):
            start = round(float(seg.start), 1)
            end = round(float(seg.end), 1)
            entries.append({
                "id": idx,
                "start_seconds": start,
                "end_seconds": end,
                "timestamp_minute": f"{format_minute(start)} - {format_minute(end)}",
                "text": seg.text.strip(),
                "speaker": "Narator"
            })
        return entries

    # Fuzzy Sequence Matching from naskah sentences to physical audio words
    current_word_idx = 0
    for i, sent in enumerate(sentences):
        sent_words = [re.sub(r'[^\w\s]', '', w.lower()) for w in sent.strip().split() if w.strip()]
        sent_len = len(sent_words)

        if sent_len == 0:
            continue

        search_window_end = min(total_words, current_word_idx + max(20, sent_len * 3))
        candidate_words = all_words[current_word_idx:search_window_end]

        best_start_idx = current_word_idx
        best_end_idx = min(total_words - 1, current_word_idx + max(0, sent_len - 1))
        best_score = -1.0

        for w_start in range(len(candidate_words)):
            for w_end in range(w_start + 1, min(len(candidate_words) + 1, w_start + sent_len + 8)):
                span_text = " ".join([w["text"] for w in candidate_words[w_start:w_end]])
                target_text = " ".join(sent_words)

                score = difflib.SequenceMatcher(None, target_text, span_text).ratio()
                if score > best_score:
                    best_score = score
                    best_start_idx = current_word_idx + w_start
                    best_end_idx = current_word_idx + w_end - 1

        start_sec = round(all_words[best_start_idx]["start"], 1)
        end_sec = round(all_words[best_end_idx]["end"], 1)

        if end_sec <= start_sec:
            end_sec = round(start_sec + 1.5, 1)

        sentence_words = [
            {
                "word": w["raw"],
                "start": round(w["start"], 2),
                "end": round(w["end"], 2)
            }
            for w in all_words[best_start_idx:best_end_idx + 1]
        ]

        entries.append({
            "id": i + 1,
            "sentence_id": i + 1,
            "start_seconds": start_sec,
            "end_seconds": end_sec,
            "start": start_sec,
            "end": end_sec,
            "timestamp_minute": f"{format_minute(start_sec)} - {format_minute(end_sec)}",
            "text": sent,
            "speaker": "Narator",
            "words": sentence_words
        })

        current_word_idx = min(total_words - 1, best_end_idx + 1)

    # Seamless gap smoothing (connect gaps <= 3.0s between consecutive sentences)
    for i in range(len(entries) - 1):
        curr_end = entries[i]["end_seconds"]
        next_start = entries[i + 1]["start_seconds"]
        if curr_end < next_start and (next_start - curr_end) <= 3.0:
            smooth_end = round(next_start, 1)
            entries[i]["end_seconds"] = smooth_end
            entries[i]["start"] = entries[i]["start_seconds"]
            entries[i]["end"] = smooth_end
            entries[i]["timestamp_minute"] = f"{format_minute(entries[i]['start_seconds'])} - {format_minute(smooth_end)}"

    return entries, all_words


def main():
    parser = argparse.ArgumentParser(description="Faster-Whisper Audio Alignment CLI")
    parser.add_argument("--audio", required=True, help="Path file audio")
    parser.add_argument("--text", required=True, help="Path script teks (.txt/.json)")
    parser.add_argument("--output", help="Path output JSON (default: stdout)")
    parser.add_argument("--model", default="small", help="Whisper model: tiny|base|small|medium|large-v2|large-v3")
    parser.add_argument("--device", default="cpu", help="cpu|cuda")
    args = parser.parse_args()

    log(f"Audio: {args.audio}")
    log(f"Teks:  {args.text}")
    log(f"Model: {args.model} on {args.device}")

    audio_dur = get_audio_duration(args.audio)
    log(f"Durasi audio: {audio_dur:.1f}s")

    raw_text = load_narration_text(args.text)
    entries, all_words = run_faster_whisper_pipeline(args.audio, raw_text, model_name=args.model, device=args.device)

    total_end = entries[-1]["end_seconds"] if entries else 0.0
    log(f"Selesai! {len(entries)} entri, total durasi transkrip {total_end:.1f}s / audio {audio_dur:.1f}s")

    formatted_words = [
        {
            "word": w["raw"],
            "start": round(w["start"], 2),
            "end": round(w["end"], 2)
        }
        for w in all_words
    ]

    output_data = {
        "mode": "faster-whisper-standalone",
        "audio_duration": round(audio_dur, 2),
        "entry_count": len(entries),
        "sentences": entries,
        "transcript": entries,
        "words": formatted_words
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        log(f"Output tersimpan: {args.output}")
    else:
        print(json.dumps(output_data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
