/*
  * BSD 2-Clause License

Copyright (c) 2010-2024, Volodymyr Agafonkin
Copyright (c) 2010-2011, CloudMade
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

// @ts-nocheck

// Ramer-Douglas-Peucker simplification, see https://en.wikipedia.org/wiki/Ramer-Douglas-Peucker_algorithm
export function simplifyDP(points, sqTolerance) {

  var len = points.length,
    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
    markers = new ArrayConstructor(len);

  markers[0] = markers[len - 1] = 1;

  _simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

  var i,
    newPoints = [];

  for (i = 0; i < len; i++) {
    if (markers[i]) {
      newPoints.push(points[i]);
    }
  }

  return newPoints;
}

function _simplifyDPStep(points, markers, sqTolerance, first, last) {

  var maxSqDist = 0,
    index, i, sqDist;

  for (i = first + 1; i <= last - 1; i++) {
    sqDist = _sqClosestPointOnSegment(points[i], points[first], points[last], true);

    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    markers[index] = 1;

    _simplifyDPStep(points, markers, sqTolerance, first, index);
    _simplifyDPStep(points, markers, sqTolerance, index, last);
  }
}


function _sqClosestPointOnSegment(p, p1, p2, sqDist) {
  var x = p1.x,
    y = p1.y,
    dx = p2.x - x,
    dy = p2.y - y,
    dot = dx * dx + dy * dy,
    t;

  if (dot > 0) {
    t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return sqDist ? dx * dx + dy * dy : { x: x, y: y };
}
