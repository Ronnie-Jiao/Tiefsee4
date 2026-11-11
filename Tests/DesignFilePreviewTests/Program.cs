using System.Drawing;
using System.Drawing.Imaging;
using System.Text;
using Tiefsee;

string directory = Path.Combine(Path.GetTempPath(), "TiefseeDesignPreviewTests-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(directory);
int assertions = 0;

try {
    string pdf = Path.Combine(directory, "compatible.ai");
    File.WriteAllText(pdf, "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", Encoding.ASCII);
    Assert(IllustratorPreviewService.HasPdfCompatibleContent(pdf), "PDF-compatible AI header");

    string noPdf = Path.Combine(directory, "legacy.ai");
    File.WriteAllText(noPdf,
        "%!PS-Adobe-3.0 EPSF-3.0\n%%BeginPreview: 2 1 1 1\n%80\n%%EndPreview\n",
        Encoding.ASCII);
    Assert(!IllustratorPreviewService.HasPdfCompatibleContent(noPdf), "PostScript is not PDF");
    using (Bitmap? preview = IllustratorPreviewService.TryReadEpsiPreview(noPdf)) {
        Assert(preview != null && preview.Width == 2 && preview.Height == 1, "embedded EPSI dimensions");
        Assert(preview?.GetPixel(0, 0).R == 0 && preview?.GetPixel(1, 0).R == 255, "EPSI black/white pixels");
    }

    string noPreview = Path.Combine(directory, "no-preview.ai");
    File.WriteAllText(noPreview, "%!PS-Adobe-3.0\n%%Creator: Illustrator\n", Encoding.ASCII);
    Assert(IllustratorPreviewService.TryReadEpsiPreview(noPreview) == null, "no fake preview for unsupported AI");

    string oversized = Path.Combine(directory, "oversized.ai");
    File.WriteAllText(oversized,
        "%!PS-Adobe-3.0\n%%BeginPreview: 500000 500000 24 1\n%00\n%%EndPreview\n",
        Encoding.ASCII);
    Assert(IllustratorPreviewService.TryReadEpsiPreview(oversized) == null, "reject untrusted preview dimensions");

    byte[] jpeg;
    using (Bitmap thumbnail = new(2, 2)) {
        thumbnail.SetPixel(0, 0, Color.Red);
        thumbnail.SetPixel(1, 1, Color.Blue);
        using MemoryStream buffer = new();
        thumbnail.Save(buffer, ImageFormat.Jpeg);
        jpeg = buffer.ToArray();
    }
    foreach (ushort version in new ushort[] { 1, 2 }) {
        string path = Path.Combine(directory, version == 1 ? "layered.psd" : "large.psb");
        File.WriteAllBytes(path, CreatePhotoshopFixture(version, jpeg));
        byte[]? extracted = PhotoshopThumbnailService.TryReadEmbeddedJpeg(path);
        Assert(extracted != null && extracted.SequenceEqual(jpeg), "PSD/PSB 1036 JPEG extraction version " + version);
    }

    Console.WriteLine($"PASS: {assertions} design preview assertions.");
}
finally {
    Directory.Delete(directory, recursive: true);
}

void Assert(bool condition, string message) {
    if (!condition) throw new Exception("FAIL: " + message);
    assertions++;
}

byte[] CreatePhotoshopFixture(ushort version, byte[] jpegData) {
    using MemoryStream resourceBuffer = new();
    using (BinaryWriter resource = new(resourceBuffer, Encoding.ASCII, leaveOpen: true)) {
        resource.Write(Encoding.ASCII.GetBytes("8BIM"));
        Be16(resource, 1036);
        resource.Write((byte)0); // zero-length Pascal name
        resource.Write((byte)0); // even-byte padding

        int dataLength = 28 + jpegData.Length;
        Be32(resource, (uint)dataLength);
        Be32(resource, 1); // JPEG thumbnail
        Be32(resource, 2); // width
        Be32(resource, 2); // height
        Be32(resource, 6); // row bytes
        Be32(resource, 12); // uncompressed bytes
        Be32(resource, (uint)jpegData.Length);
        Be16(resource, 24); // bits per pixel
        Be16(resource, 1); // planes
        resource.Write(jpegData);
        if ((dataLength & 1) != 0) resource.Write((byte)0);
    }

    using MemoryStream document = new();
    using BinaryWriter w = new(document, Encoding.ASCII, leaveOpen: true);
    w.Write(Encoding.ASCII.GetBytes("8BPS"));
    Be16(w, version);
    w.Write(new byte[6]); // reserved
    Be16(w, 3); // channels
    Be32(w, 2); // height
    Be32(w, 2); // width
    Be16(w, 8); // depth
    Be16(w, 3); // RGB
    Be32(w, 0); // no color-mode data
    Be32(w, (uint)resourceBuffer.Length);
    w.Write(resourceBuffer.ToArray());
    return document.ToArray();
}

void Be16(BinaryWriter w, ushort value) {
    w.Write((byte)(value >> 8));
    w.Write((byte)value);
}

void Be32(BinaryWriter w, uint value) {
    w.Write((byte)(value >> 24));
    w.Write((byte)(value >> 16));
    w.Write((byte)(value >> 8));
    w.Write((byte)value);
}
