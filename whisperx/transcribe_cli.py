#!/usr/bin/env python3
"""
WhisperX CLI Transcriber for Spensia & Content-Auto
Optimized for high speed, lightweight memory usage, and zero system freeze.
"""

import sys
import os

# ─── PREVENT CPU THREAD STARVATION / LAPTOP FREEZING ───
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["VECLIB_MAXIMUM_THREADS"] = "4"
os.environ["NUMEXPR_NUM_THREADS"] = "4"

import json
import argparse
import logging

try:
    import torch
    torch.set_num_threads(4)
except Exception:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("whisperx_cli")


def parse_args():
    parser = argparse.ArgumentParser(description="WhisperX High-Precision Audio Transcriber")
    parser.add_argument("--audio", help="Path to input audio file (.wav, .mp3, .m4a)")
    parser.add_argument("--output", help="Path to save output JSON file")
    parser.add_argument("--model", default="small", help="Whisper model size (tiny, base, small, medium, large-v3)")
    parser.add_argument("--language", default="id", help="Language code (default: id)")
    parser.add_argument("--device", default="auto", help="Device (cuda, cpu, auto)")
    parser.add_argument("--compute_type", default=None, help="Compute precision (float16, int8, float32)")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size for inference")
    parser.add_argument("--download_only", action="store_true", help="Pre-download WhisperX & alignment models to cache and exit")
    return parser.parse_args()


def format_spensia_json(whisperx_result, aligned_result):
    """
    Format raw WhisperX aligned output into Spensia hierarchical JSON schema:
    {
      "transcript_full": "...",
      "chunks": [
        {
          "chunk_id": 1,
          "text": "...",
          "start": 0.00,
          "end": 1.20,
          "words": [{"word": "...", "start": 0.00, "end": 0.58}]
        }
      ],
      "words": [...]
    }
    """
    full_text_list = []
    chunks = []
    flat_words = []

    segments = aligned_result.get("segments", [])

    for idx, seg in enumerate(segments):
        chunk_id = idx + 1
        seg_text = seg.get("text", "").strip()
        if not seg_text:
            continue

        full_text_list.append(seg_text)

        seg_words_raw = seg.get("words", [])
        chunk_words = []

        for w_item in seg_words_raw:
            w_text = w_item.get("word", "").strip()
            if not w_text:
                continue

            # Fallback to segment start/end if word alignment missing
            w_start = w_item.get("start")
            w_end = w_item.get("end")

            if w_start is None:
                w_start = float(seg.get("start", 0.0))
            if w_end is None:
                w_end = w_start + 0.3

            w_start = round(float(w_start), 2)
            w_end = round(float(w_end), 2)
            if w_end <= w_start:
                w_end = round(w_start + 0.25, 2)

            word_obj = {
                "word": w_text,
                "start": w_start,
                "end": w_end
            }
            chunk_words.append(word_obj)
            flat_words.append(word_obj)

        chunk_start = round(float(seg.get("start", chunk_words[0]["start"] if chunk_words else 0.0)), 2)
        chunk_end = round(float(seg.get("end", chunk_words[-1]["end"] if chunk_words else chunk_start + 1.0)), 2)
        if chunk_end <= chunk_start:
            chunk_end = round(chunk_start + 0.5, 2)

        chunks.append({
            "chunk_id": chunk_id,
            "text": seg_text,
            "start": chunk_start,
            "end": chunk_end,
            "words": chunk_words
        })

    transcript_full = " ".join(full_text_list).strip()

    return {
        "transcript_full": transcript_full,
        "chunks": chunks,
        "words": flat_words
    }


def load_whisper_model_with_fallback(whisperx, model_name, device="auto", compute_type=None, language="id"):
    """
    Load Whisper model with safe GPU (CUDA) and CPU fallback strategy.
    Prevents laptop freeze by using optimal compute_type and thread controls.
    """
    import torch

    requested_device = device.lower() if device else "auto"
    cuda_available = torch.cuda.is_available()

    if requested_device == "cuda" and not cuda_available:
        logger.warning("⚠️ CUDA GPU requested but torch.cuda.is_available() is False. Falling back to CPU mode.")
        requested_device = "cpu"

    candidates = []

    # Safe CUDA GPU candidate list (float16 / int8_float16 / int8)
    if requested_device in ["cuda", "gpu", "auto"] and cuda_available:
        if compute_type:
            candidates.append(("cuda", compute_type))
        candidates.extend([
            ("cuda", "float16"),
            ("cuda", "int8_float16"),
            ("cuda", "int8"),
            ("cuda", "float32")
        ])

    # Safe CPU candidate list (int8 / float32 fallback)
    if compute_type and requested_device == "cpu":
        candidates.append(("cpu", compute_type))
    candidates.extend([
        ("cpu", "int8"),
        ("cpu", "float32")
    ])

    last_error = None
    tried = set()

    for dev, ct in candidates:
        if (dev, ct) in tried:
            continue
        tried.add((dev, ct))
        try:
            logger.info(f"Loading WhisperX model '{model_name}' on '{dev}' with compute_type '{ct}'...")
            model = whisperx.load_model(model_name, dev, compute_type=ct, language=language)
            logger.info(f"✅ Successfully loaded WhisperX model on '{dev}' with compute_type '{ct}'!")
            return model, dev, ct
        except Exception as err:
            logger.warning(f"⚠️ Could not load model on {dev} with compute_type '{ct}': {err}")
            last_error = err

    raise last_error or RuntimeError("Failed to load WhisperX model on any device/precision configuration.")


def log_progress(msg):
    logger.info(msg)
    sys.stderr.flush()


def run_transcription(audio_path, model_name="small", language="id", device="auto", compute_type=None, batch_size=4):
    try:
        import torch
        import whisperx
    except ImportError as e:
        log_progress("❌ ERROR: WhisperX or PyTorch is not installed in current Python environment!")
        log_progress("Please run `bash whisperx/setup_venv.sh` or install requirements.")
        raise e

    # ─── PHASE 1: AUDIO ANALYSIS ───
    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024) if os.path.exists(audio_path) else 0
    log_progress(f"📂 [1/5] Memeriksa audio file: {os.path.basename(audio_path)} ({file_size_mb:.2f} MB)")
    
    log_progress("⏳ [1/5] Memuat file audio ke memori (16kHz mono resampling)...")
    audio = whisperx.load_audio(audio_path)
    
    duration_sec = len(audio) / 16000.0
    mins = int(duration_sec // 60)
    secs = int(duration_sec % 60)
    ms = int((duration_sec - int(duration_sec)) * 100)
    log_progress(f"✅ [1/5] Audio berhasil dimuat! Total durasi: {mins:02d}:{secs:02d}.{ms:02d} ({duration_sec:.2f} detik, {len(audio):,} sampel)")

    # ─── PHASE 2: MODEL INITIALIZATION ───
    log_progress(f"🤖 [2/5] Menginisialisasi Whisper model '{model_name}' (device: {device}, precision: {compute_type or 'auto'})...")
    model, active_device, active_compute_type = load_whisper_model_with_fallback(
        whisperx, model_name, device=device, compute_type=compute_type, language=language
    )
    log_progress(f"✅ [2/5] Whisper model '{model_name}' ({active_compute_type}) siap pada device '{active_device}'!")

    # ─── PHASE 3: VAD & TRANSCRIPTION ───
    log_progress(f"🎙️ [3/5] Menjalankan PyTorch VAD & CTranslate2 Transkripsi (batch_size={batch_size}, lang={language})...")
    result = model.transcribe(audio, batch_size=batch_size, language=language)
    
    raw_segments = result.get("segments", [])
    log_progress(f"✅ [3/5] Transkripsi mentah selesai! Terdeteksi {len(raw_segments)} segmen percakapan:")
    for s_idx, seg in enumerate(raw_segments[:15]):  # Preview first 15 segments
        s_start = float(seg.get("start", 0.0))
        s_end = float(seg.get("end", 0.0))
        s_text = seg.get("text", "").strip()
        log_progress(f"   ├─ Segmen {s_idx+1}/{len(raw_segments)} [{s_start:.2f}s ➔ {s_end:.2f}s]: \"{s_text}\"")
    if len(raw_segments) > 15:
        log_progress(f"   └─ ...dan {len(raw_segments)-15} segmen lainnya.")

    # ─── PHASE 4: FORCED ALIGNMENT (WORD TIMESTAMPS) ───
    log_progress(f"🎯 [4/5] Memuat Wav2Vec2 Forced Alignment model untuk bahasa '{language}' pada '{active_device}'...")
    try:
        model_a, metadata = whisperx.load_align_model(
            language_code=language,
            device=active_device
        )
        log_progress("⏳ [4/5] Mengodekan gelombang audio & menyelaraskan timestamp tiap kata (word-level precision)...")
        aligned_result = whisperx.align(
            result["segments"],
            model_a,
            metadata,
            audio,
            active_device,
            return_char_alignments=False
        )
        log_progress("✅ [4/5] Alignment kata presisi tinggi (Forced Alignment) berhasil diselesaikan!")
    except Exception as align_err:
        log_progress(f"⚠️ [4/5] Warning Forced alignment ({align_err}). Retrying on CPU alignment...")
        try:
            model_a, metadata = whisperx.load_align_model(
                language_code=language,
                device="cpu"
            )
            aligned_result = whisperx.align(
                result["segments"],
                model_a,
                metadata,
                audio,
                "cpu",
                return_char_alignments=False
            )
            log_progress("✅ [4/5] Alignment kata CPU berhasil diselesaikan!")
        except Exception as fallback_err:
            log_progress(f"⚠️ [4/5] Forced alignment fallback gagal ({fallback_err}). Menggunakan timestamp segmen standar...")
            aligned_result = result

    # ─── PHASE 5: FORMATTING & SCHEMA ───
    log_progress("⚙️ [5/5] Memformat struktur JSON ke hirarki Spensia (chunks & word metadata)...")
    spensia_data = format_spensia_json(result, aligned_result)
    
    total_chunks = len(spensia_data.get('chunks', []))
    total_words = len(spensia_data.get('words', []))
    full_text_len = len(spensia_data.get('transcript_full', ''))
    
    log_progress(f"📊 [5/5] Ringkasan Transkrip Selesai:")
    log_progress(f"   ├─ Total Chunks: {total_chunks}")
    log_progress(f"   ├─ Total Kata: {total_words}")
    log_progress(f"   └─ Panjang Teks: {full_text_len} karakter")
    log_progress("🎉 Seluruh tahapan transkripsi WhisperX selesai dengan sukses!")

    return spensia_data


def preload_models(model_name="small", language="id", device="auto", compute_type=None):
    try:
        import torch
        import whisperx
    except ImportError as e:
        log_progress("❌ ERROR: WhisperX atau PyTorch tidak terinstall!")
        raise e

    model, active_device, active_compute_type = load_whisper_model_with_fallback(
        whisperx, model_name, device=device, compute_type=compute_type, language=language
    )

    log_progress(f"📥 Pre-downloading Alignment model untuk bahasa '{language}' pada '{active_device}'...")
    whisperx.load_align_model(language_code=language, device=active_device)
    log_progress("✅ Model berhasil di-download & disimpan di cache!")


def main():
    args = parse_args()

    if args.download_only:
        preload_models(model_name=args.model, language=args.language, device=args.device, compute_type=args.compute_type)
        sys.exit(0)

    if not args.audio or not os.path.exists(args.audio):
        log_progress("❌ ERROR: Tolong tentukan path file audio yang valid --audio <path>")
        sys.exit(1)

    output_data = run_transcription(
        audio_path=args.audio,
        model_name=args.model,
        language=args.language,
        device=args.device,
        compute_type=args.compute_type,
        batch_size=args.batch_size
    )

    json_str = json.dumps(output_data, indent=2, ensure_ascii=False)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(json_str)
        log_progress(f"💾 Hasil transkrip berhasil disimpan di: {args.output}")

    # Output JSON string to stdout for Electron process
    print(json_str)


if __name__ == "__main__":
    main()
