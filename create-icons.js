const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  
  // Draw rounded rectangle background
  const radius = size * 0.2;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw lightning bolt
  ctx.strokeStyle = 'white';
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const scale = size / 24;
  ctx.save();
  ctx.translate(size/2, size/2);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  
  // Lightning bolt path
  ctx.beginPath();
  ctx.moveTo(13, 2);
  ctx.lineTo(3, 14);
  ctx.lineTo(12, 14);
  ctx.lineTo(11, 22);
  ctx.lineTo(21, 10);
  ctx.lineTo(12, 10);
  ctx.lineTo(13, 2);
  ctx.closePath();
  
  ctx.fillStyle = 'white';
  ctx.fill();
  
  ctx.restore();
  
  return canvas.toBuffer('image/png');
}

// Create all icon sizes
[16, 48, 128].forEach(size => {
  const buffer = createIcon(size);
  fs.writeFileSync(`icon-${size}.png`, buffer);
  console.log(`Created icon-${size}.png`);
});