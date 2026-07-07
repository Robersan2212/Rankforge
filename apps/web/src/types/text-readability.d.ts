declare module "text-readability" {
  interface Readability {
    fleschReadingEase(text: string): number;
  }

  const readability: Readability;
  export default readability;
}
