import os
import sys
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile

# Allow both `uvicorn fastapi_app:app` (from this folder) and an absolute-path launch.
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from predict_tea_disease import CLASS_NAMES, MODEL_NAME, predict_detailed  # noqa: E402

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB, matching the Next.js route limit

app = FastAPI(title="CeylonGuard Tea Disease API", version="1.1.0")


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "model": MODEL_NAME, "classes": list(CLASS_NAMES)}


@app.post("/predict")
async def predict(image: UploadFile = File(...)) -> dict[str, Any]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")

    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 10 MB.")

    try:
        return predict_detailed(image_bytes)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}") from exc
