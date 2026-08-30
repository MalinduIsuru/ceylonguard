import base64
import io
import json
import os
import sys
from typing import Any

import numpy as np
import tensorflow as tf
from PIL import Image

MODEL_PATH = os.path.join(os.path.dirname(__file__), "tea_trained_model.keras")
MODEL_NAME = "tea_trained_model.keras"
IMAGE_SIZE = (128, 128)

CLASS_NAMES = [
    "Anthracnose",
    "algal leaf",
    "bird eye spot",
    "brown blight",
    "gray light",
    "healthy",
    "red leaf spot",
    "white spot",
]

MODEL = tf.keras.models.load_model(MODEL_PATH)


def _preprocess(image_bytes: bytes) -> np.ndarray:
    """Decode, resize and batch an image exactly as the model was trained."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize(IMAGE_SIZE)

    input_arr = np.array(image, dtype=np.float32)
    return np.array([input_arr])


def _to_probabilities(raw: np.ndarray) -> np.ndarray:
    """Return a probability vector, applying softmax only if the head emits logits."""
    values = np.asarray(raw, dtype=np.float64)

    if values.min() >= 0.0 and np.isclose(values.sum(), 1.0, atol=1e-3):
        return values

    shifted = np.exp(values - values.max())
    return shifted / shifted.sum()


def predict_detailed(image_bytes: bytes) -> dict[str, Any]:
    """Classify a leaf image and return the winner plus every class probability."""
    raw = MODEL.predict(_preprocess(image_bytes), verbose=0)[0]
    probabilities = _to_probabilities(raw)

    ranked = [
        {
            "disease": CLASS_NAMES[int(index)],
            "confidence": round(float(probabilities[int(index)]) * 100.0, 2),
        }
        for index in np.argsort(probabilities)[::-1]
    ]

    return {
        "disease": ranked[0]["disease"],
        "confidence": ranked[0]["confidence"],
        "model": MODEL_NAME,
        "predictions": ranked,
    }


def predict_from_image_bytes(image_bytes: bytes) -> tuple[str, float]:
    """Backwards-compatible helper: returns just (disease, confidence)."""
    result = predict_detailed(image_bytes)
    return result["disease"], result["confidence"]


def main() -> int:
    raw_base64 = sys.stdin.read().strip()
    if not raw_base64:
        print("No image data received.", file=sys.stderr)
        return 1

    try:
        image_bytes = base64.b64decode(raw_base64)
        print(json.dumps(predict_detailed(image_bytes)))
        return 0
    except Exception as exc:
        print(f"Inference error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
