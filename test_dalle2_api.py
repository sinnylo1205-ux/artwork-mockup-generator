#!/usr/bin/env python3
"""
Test script to call the DALL-E 2 API endpoint directly
"""
import requests
import base64
import json
from PIL import Image
import io

# Create a simple red square image (100x100)
img = Image.new('RGB', (100, 100), color='red')
buffer = io.BytesIO()
img.save(buffer, format='PNG')
image_bytes = buffer.getvalue()
image_base64 = base64.b64encode(image_bytes).decode('utf-8')

print(f"Image size: {len(image_bytes)} bytes ({len(image_bytes) / 1024:.2f} KB)")
print(f"Base64 length: {len(image_base64)} chars")

# Prepare request
url = "https://3000-igclkx7dmcj62zgqryxj8-ad7f5c96.sg1.manus.computer/api/trpc/artwork.generateMockups"
payload = {
    "json": {
        "originalImageUrl": "https://example.com/test.png",
        "originalImageKey": "test-key",
        "originalImageBase64": image_base64,
        "orientation": "square",
        "frameColors": ["brushed_black"],
        "roomStyles": ["japanese"],
        "viewAngles": ["front"],
        "imageGenerationCore": "openai"
    }
}

print("\nSending request to backend...")
print(f"Payload size: {len(json.dumps(payload))} bytes")

response = requests.post(url, json=payload)
print(f"\nResponse status: {response.status_code}")
print(f"Response body: {response.text[:500]}")
