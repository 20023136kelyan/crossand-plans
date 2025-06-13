declare module 'colorthief' {
  export default class ColorThief {
    /**
     * Get the dominant color from an image
     * @param img - HTML Image element
     * @returns RGB color array [r, g, b]
     */
    getColor(img: HTMLImageElement): [number, number, number] | null;

    /**
     * Get a palette of colors from an image
     * @param img - HTML Image element
     * @param colorCount - Number of colors to extract (default: 10)
     * @param quality - Quality of color extraction (default: 10)
     * @returns Array of RGB color arrays [[r, g, b], ...]
     */
    getPalette(
      img: HTMLImageElement,
      colorCount?: number,
      quality?: number
    ): number[][] | null;
  }
}