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


def run_faster_whisper_pipeline(audio_path: str, raw_text: str, model_name: str = "medium", device: str = "cpu") -> list:
    from faster_whisper import WhisperModel

    log(f"Load faster-whisper model ({model_name} on {device})...")
    compute_type = "int8" if device == "cpu" else "float16"
    model = WhisperModel(model_name, device=device, compute_type=compute_type)

    log(f"Transcribing audio fisik dengan Silero VAD & Word Timestamps...")
    start_t = time.time()
    segments_gen, info = model.transcribe(
        audio_path,
        language="id",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400),
        word_timestamps=True
    )

    fw_segments = list(segments_gen)
    log(f"  Selesai VAD Transcribe dalam {time.time() - start_t:.1f}s. Terdeteksi {len(fw_segments)} segmen fisik.")

    sentences = split_sentences(raw_text)
    log(f"Mapping {len(sentences)} kalimat naskah asli ke {len(fw_segments)} segmen audio fisik...")

    entries = []
    n_sent = len(sentences)
    n_seg = len(fw_segments)

    if n_sent == 0 or n_seg == 0:
        # Fallback ke segmen VAD murni jika naskah kosong
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

    # Mapping Naskah Asli ke segmen VAD fisik
    for i, sent in enumerate(sentences):
        seg_idx = int(round((i / n_sent) * (n_seg - 1)))
        seg_idx = max(0, min(n_seg - 1, seg_idx))
        cur_seg = fw_segments[seg_idx]

        start = round(float(cur_seg.start), 1)
        end = round(float(cur_seg.end), 1)

        # Ambil word timestamps jika tersedia untuk memperhalus start & end
        if hasattr(cur_seg, "words") and cur_seg.words:
            w_starts = [w.start for w in cur_seg.words if w.start is not None]
            w_ends = [w.end for w in cur_seg.words if w.end is not None]
            if w_starts:
                start = round(float(min(w_starts)), 1)
            if w_ends:
                end = round(float(max(w_ends)), 1)

        if end <= start:
            end = round(start + 1.5, 1)

        entries.append({
            "id": i + 1,
            "start_seconds": start,
            "end_seconds": end,
            "timestamp_minute": f"{format_minute(start)} - {format_minute(end)}",
            "text": sent,
            "speaker": "Narator"
        })

    # Smooth small gaps (< 1.5s) antar kalimat berurutan
    for i in range(len(entries) - 1):
        curr_end = entries[i]["end_seconds"]
        next_start = entries[i + 1]["start_seconds"]
        if curr_end < next_start and (next_start - curr_end) <= 1.5:
            smooth_end = round(next_start - 0.1, 1)
            if smooth_end > entries[i]["start_seconds"]:
                entries[i]["end_seconds"] = smooth_end
                entries[i]["timestamp_minute"] = f"{format_minute(entries[i]['start_seconds'])} - {format_minute(smooth_end)}"

    return entries


def main():
    parser = argparse.ArgumentParser(description="Faster-Whisper Audio Alignment CLI")
    parser.add_argument("--audio", required=True, help="Path file audio")
    parser.add_argument("--text", required=True, help="Path script teks (.txt/.json)")
    parser.add_argument("--output", help="Path output JSON (default: stdout)")
    parser.add_argument("--model", default="medium", help="Whisper model: tiny|base|small|medium|large-v2|large-v3")
    parser.add_argument("--device", default="cpu", help="cpu|cuda")
    args = parser.parse_args()

    log(f"Audio: {args.audio}")
    log(f"Teks:  {args.text}")
    log(f"Model: {args.model} on {args.device}")

    audio_dur = get_audio_duration(args.audio)
    log(f"Durasi audio: {audio_dur:.1f}s")

    raw_text = load_narration_text(args.text)
    entries = run_faster_whisper_pipeline(args.audio, raw_text, model_name=args.model, device=args.device)

    total_end = entries[-1]["end_seconds"] if entries else 0.0
    log(f"Selesai! {len(entries)} entri, total durasi transkrip {total_end:.1f}s / audio {audio_dur:.1f}s")

    output_data = {
        "mode": "faster-whisper-standalone",
        "audio_duration": round(audio_dur, 2),
        "entry_count": len(entries),
        "transcript": entries
    }

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        log(f"Output tersimpan: {args.output}")
    else:
        print(json.dumps(output_data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
