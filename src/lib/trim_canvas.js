// Modified from https://gist.github.com/timdown/021d9c8f2aabc7092df564996f5afbbf

function rowBlank(imageData, width, y) {
    for (var x = 0; x < width; ++x) {
        if (imageData.data[y * width * 4 + x * 4 + 3] !== 0) return false;
    }
    return true;
}

function columnBlank(imageData, width, x, top, bottom) {
    for (var y = top; y < bottom; ++y) {
        if (imageData.data[y * width * 4 + x * 4 + 3] !== 0) return false;
    }
    return true;
}

function trimCanvas (canvas) {
    var ctx = canvas.getContext("2d");
    var width = canvas.width;
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var top = 0, bottom = imageData.height, left = 0, right = imageData.width;

    while (top < bottom && rowBlank(imageData, width, top)) ++top;
    while (bottom - 1 > top && rowBlank(imageData, width, bottom - 1)) --bottom;
    while (left < right && columnBlank(imageData, width, left, top, bottom)) ++left;
    while (right - 1 > left && columnBlank(imageData, width, right - 1, top, bottom)) --right;
 
    var trimmed = ctx.getImageData(left, top, right - left, bottom - top);
    var copy = canvas.ownerDocument.createElement("canvas");
    var copyCtx = copy.getContext("2d");
    copy.width = trimmed.width;
    copy.height = trimmed.height;
    copyCtx.putImageData(trimmed, 0, 0);

    return {
        canvas: copy,
        x: - (imageData.width - right - left) / 2,
        y: - (imageData.height - bottom - top) / 2
    };
}

module.exports = exports = {trimCanvas}
