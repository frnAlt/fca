export interface ThemeAssetImage {
  url: string | null;
}

export interface ThemeBackgroundAsset {
  id: string | null;
  image: ThemeAssetImage;
}

export interface CreateThemeAIResult {
  id: string;
  accessibility_label: string | null;
  background_asset: ThemeBackgroundAsset;
}

export type ThemePicturesResult = Loose;
