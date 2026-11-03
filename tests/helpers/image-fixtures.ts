// Small, complete images so upload regressions exercise real file contents.
export const imageFixtures = [
  {
    contentType: 'image/jpeg', ext: '.jpg',
    data: Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z', 'base64'),
  },
  {
    contentType: 'image/png', ext: '.png',
    data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC', 'base64'),
  },
  {
    contentType: 'image/gif', ext: '.gif',
    data: Buffer.from('R0lGODlhAQABAIAAAExpcf///yH5BAUAAAAALAAAAAABAAEAAAICTAEAOw==', 'base64'),
  },
  {
    contentType: 'image/webp', ext: '.webp',
    data: Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=', 'base64'),
  },
  {
    contentType: 'image/x-icon', ext: '.ico',
    data: Buffer.from('AAABAAEAAQEAAAEAGABaAAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAABAAAAAQgCAAAAkHdT3gAAAAlwSFlzAAAD6AAAA+gBtXtSawAAAAxJREFUCJlj+P//PwAF/gL+WPJrDgAAAABJRU5ErkJggg==', 'base64'),
  },
  {
    contentType: 'image/svg+xml', ext: '.svg',
    data: Buffer.from('\uFEFF<?xml version="1.0" encoding="UTF-8"?>\n<!-- vector image -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><circle cx="0.5" cy="0.5" r="0.5"/></svg>'),
  },
]
