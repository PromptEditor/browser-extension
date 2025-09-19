#!/usr/bin/env python3
from PIL import Image, ImageDraw

def create_icon(size):
    # Create image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw rounded rectangle with gradient effect (simplified)
    # Using a solid purple color for simplicity
    radius = size // 5
    color = (102, 126, 234, 255)  # Purple-blue color
    
    # Draw rounded rectangle
    draw.rounded_rectangle(
        [(0, 0), (size-1, size-1)],
        radius=radius,
        fill=color
    )
    
    # Draw a simple lightning bolt (simplified as lines)
    white = (255, 255, 255, 255)
    scale = size / 24
    
    # Lightning bolt coordinates scaled
    points = [
        (13 * scale, 2 * scale),
        (3 * scale, 14 * scale),
        (12 * scale, 14 * scale),
        (11 * scale, 22 * scale),
        (21 * scale, 10 * scale),
        (12 * scale, 10 * scale),
        (13 * scale, 2 * scale)
    ]
    
    # Draw lightning bolt as polygon
    draw.polygon(points, fill=white, outline=white)
    
    return img

# Create icons for all sizes
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'icon-{size}.png', 'PNG')
    print(f'Created icon-{size}.png')

print('All icons created successfully!')