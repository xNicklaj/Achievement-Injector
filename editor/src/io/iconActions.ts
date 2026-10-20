import { confirmDialog, message } from "../components/dialogs";
import { useApp } from "../store";
import { encodeBc3Dds, ICON_SIZE, parseDds } from "./dds";

/** Any browser-readable picture (PNG, JPEG, WebP) as a 512x512 BC3 DDS: scaled to cover the square and centre-cropped. */
async function pictureToDds(file: File): Promise<Uint8Array> {
  const bmp = await createImageBitmap(file);
  const c = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  const side = Math.min(bmp.width, bmp.height);
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, ICON_SIZE, ICON_SIZE);
  return encodeBc3Dds(g.getImageData(0, 0, ICON_SIZE, ICON_SIZE));
}

/**
 * Choose an icon file to add. A picture (PNG and so on) is converted to BC3 DDS first. It is checked first (the game reads BC3 and below, at 512x512), then queued to be
 * written on Save. Returns the file name used, or undefined when the user backed out or the file was refused.
 */
export async function addIconFile(file: File, destination: (fileName: string) => string, replaces: (fileName: string) => boolean = () => false): Promise<string | undefined> {
  const picture = /^image\/(png|jpeg|webp|bmp|gif)$/.test(file.type);
  if (!picture && !/\.dds$/i.test(file.name)) return void (await message("Not an icon file", `${file.name} is not a .dds or picture file. Icons are DDS textures (BC3 / DXT5, 512×512); PNG files are converted.`));
  let bytes: Uint8Array;
  try {
    bytes = picture ? await pictureToDds(file) : new Uint8Array(await file.arrayBuffer());
  } catch {
    return void (await message("Could not read the picture", `${file.name} could not be decoded.`));
  }
  const name = picture ? file.name.replace(/\.[^.]*$/, "") + ".dds" : file.name;
  const parsed = parseDds(bytes);
  if (!parsed.ok) return void (await message("Could not read the icon", `${file.name}: ${parsed.error}`));
  const { info } = parsed;
  if (!info.supported) return void (await message("Unsupported icon format", `${file.name} is ${info.label}. ${info.problems[0]}\n\nRe-export it as BC3 (DXT5).`));
  if (info.problems.length && !(await confirmDialog("Use this icon anyway?", info.problems, "Use it", `${file.name} may not display as intended.`))) return;
  if (replaces(name) && !(await confirmDialog("Replace icon?", [], "Replace", `${name} already exists and will be overwritten when you save.`))) return;
  useApp.getState().addPendingIcon(destination(name), bytes);
  return name;
}
