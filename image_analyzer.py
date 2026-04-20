from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


@dataclass(frozen=True)
class Prediction:
    label: str
    score: float


class ImageAnalyzer:
    """Analyze an image and generate a human-like description.

    The implementation combines three model outputs:
    - Object detection
    - Scene/context classification
    - Caption generation

    Model pipelines are loaded lazily so import-time remains lightweight.
    """

    def __init__(
        self,
        object_model: str = "facebook/detr-resnet-50",
        scene_model: str = "google/vit-base-patch16-224",
        caption_model: str = "Salesforce/blip-image-captioning-base",
    ) -> None:
        self.object_model = object_model
        self.scene_model = scene_model
        self.caption_model = caption_model
        self._object_detector = None
        self._scene_classifier = None
        self._captioner = None

    def _load_pipelines(self) -> None:
        if self._object_detector and self._scene_classifier and self._captioner:
            return

        try:
            from transformers import pipeline
        except Exception as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "transformers is required. Install dependencies before running image analysis."
            ) from exc

        self._object_detector = pipeline("object-detection", model=self.object_model)
        self._scene_classifier = pipeline("image-classification", model=self.scene_model)
        self._captioner = pipeline("image-to-text", model=self.caption_model)

    @staticmethod
    def _deduplicate(predictions: Iterable[Prediction], top_k: int) -> List[Prediction]:
        selected: List[Prediction] = []
        seen = set()
        for pred in sorted(predictions, key=lambda p: p.score, reverse=True):
            normalized = pred.label.lower()
            if normalized in seen:
                continue
            seen.add(normalized)
            selected.append(pred)
            if len(selected) == top_k:
                break
        return selected

    @staticmethod
    def compose_description(
        caption: str,
        objects: List[str],
        scene: Optional[str],
    ) -> str:
        cleaned_caption = caption.strip().rstrip(".")
        parts = [cleaned_caption] if cleaned_caption else []

        if scene:
            parts.append(f"The scene appears to be {scene}.")

        if objects:
            if len(objects) == 1:
                object_text = objects[0]
            elif len(objects) == 2:
                object_text = f"{objects[0]} and {objects[1]}"
            else:
                object_text = ", ".join(objects[:-1]) + f", and {objects[-1]}"
            parts.append(f"Notable objects include {object_text}.")

        if not parts:
            return "Unable to generate a reliable description for this image."

        base = " ".join(parts)
        if not base.endswith("."):
            base += "."
        return base

    def analyze_image(self, image_path: str | Path, top_k: int = 3) -> Dict[str, Any]:
        self._load_pipelines()

        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image file not found: {path}")

        try:
            from PIL import Image
        except Exception as exc:  # pragma: no cover - environment dependent
            raise RuntimeError(
                "Pillow is required. Install dependencies before running image analysis."
            ) from exc

        image = Image.open(path).convert("RGB")

        object_results = self._object_detector(image)
        scene_results = self._scene_classifier(image)
        caption_results = self._captioner(image)

        object_predictions = [
            Prediction(label=item.get("label", "object"), score=float(item.get("score", 0.0)))
            for item in object_results
        ]
        top_objects = self._deduplicate(object_predictions, top_k=top_k)

        scene_label = scene_results[0].get("label") if scene_results else None
        caption = caption_results[0].get("generated_text", "") if caption_results else ""

        description = self.compose_description(
            caption=caption,
            objects=[obj.label for obj in top_objects],
            scene=scene_label,
        )

        return {
            "description": description,
            "caption": caption,
            "scene": scene_label,
            "objects": [
                {
                    "label": obj.label,
                    "score": round(obj.score, 4),
                }
                for obj in top_objects
            ],
        }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate human-like image descriptions")
    parser.add_argument("image", help="Path to image file")
    parser.add_argument("--top-k", type=int, default=3, help="Number of objects to include")
    return parser


def main() -> None:
    args = _build_parser().parse_args()
    analyzer = ImageAnalyzer()
    result = analyzer.analyze_image(args.image, top_k=max(1, args.top_k))
    print(result["description"])


if __name__ == "__main__":
    main()
