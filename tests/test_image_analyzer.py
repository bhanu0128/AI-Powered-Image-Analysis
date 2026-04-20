import unittest

from image_analyzer import ImageAnalyzer, Prediction


class TestImageAnalyzerDescription(unittest.TestCase):
    def test_compose_description_with_scene_and_objects(self):
        description = ImageAnalyzer.compose_description(
            caption="A person standing in a park",
            objects=["person", "bench", "dog"],
            scene="park",
        )
        self.assertIn("A person standing in a park", description)
        self.assertIn("The scene appears to be park.", description)
        self.assertIn("Notable objects include person, bench, and dog.", description)

    def test_compose_description_fallback(self):
        description = ImageAnalyzer.compose_description(caption="", objects=[], scene=None)
        self.assertEqual(
            description,
            "Unable to generate a reliable description for this image.",
        )

    def test_deduplicate_keeps_highest_scores(self):
        predictions = [
            Prediction(label="car", score=0.2),
            Prediction(label="Car", score=0.9),
            Prediction(label="tree", score=0.8),
            Prediction(label="person", score=0.7),
        ]
        deduped = ImageAnalyzer._deduplicate(predictions, top_k=3)
        self.assertEqual([p.label for p in deduped], ["Car", "tree", "person"])


if __name__ == "__main__":
    unittest.main()
