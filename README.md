# AI-Powered-Image-Analysis

A deep learning-based tool that analyzes images, identifies key elements, and converts visual data into meaningful, human-readable descriptions.

## What it does

`image_analyzer.py` builds a human-like image description by combining:
- object detection
- scene/context classification
- image caption generation

## Setup

```bash
pip install -r requirements.txt
```

## Usage

```bash
python image_analyzer.py /absolute/path/to/image.jpg --top-k 3
```

The command prints a natural language description synthesized from detected objects, scene context, and generated caption text.

## Run tests

```bash
python -m unittest discover -s tests -p "test_*.py"
```
