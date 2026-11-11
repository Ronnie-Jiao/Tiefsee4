using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace Tiefsee;

/// <summary>
/// Safely inspects Illustrator documents without invoking an external PostScript
/// interpreter. PDF-compatible AI is sent to the existing PDF viewer. For older
/// PostScript/EPS-based AI, an optional embedded EPSI bitmap can be extracted.
/// Native Illustrator artwork without a preview is NOT generally renderable here.
/// </summary>
public static class IllustratorPreviewService {
    private const int PdfHeaderSearchBytes = 1024;
    private const int MaxEpsiSectionBytes = 12 * 1024 * 1024;
    private const int MaxPreviewDimension = 4096;
    private const long MaxPreviewPixels = 4L * 1024 * 1024;

    public static bool HasPdfCompatibleContent(string path) {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        Span<byte> buffer = stackalloc byte[PdfHeaderSearchBytes];
        int length = stream.Read(buffer);
        ReadOnlySpan<byte> signature = "%PDF-"u8;
        // PDF readers permit a short header offset. Do not search arbitrary
        // embedded binary content or falsely classify PostScript files as PDF.
        for (int i = 0; i <= Math.Min(length - signature.Length, 31); i++) {
            if (buffer.Slice(i, signature.Length).SequenceEqual(signature)) return true;
        }
        return false;
    }

    /// <summary>
    /// Read the optional %%BeginPreview bitmap found in some legacy
    /// PostScript/EPS-flavored .ai files. Supports 1/8/24 bits per pixel.
    /// Bounds are intentionally strict: input is an untrusted design file.
    /// </summary>
    public static Bitmap TryReadEpsiPreview(string path) {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        int amount = (int)Math.Min(stream.Length, MaxEpsiSectionBytes);
        if (amount < 32) return null;

        byte[] bytes = new byte[amount];
        int total = 0;
        while (total < amount) {
            int received = stream.Read(bytes, total, amount - total);
            if (received == 0) break;
            total += received;
        }

        // Avoid running a general-purpose EPS interpreter on arbitrary input.
        if (total < 4 || bytes[0] != (byte)'%' || bytes[1] != (byte)'!' ||
            bytes[2] != (byte)'P' || bytes[3] != (byte)'S') return null;

        string text = Encoding.ASCII.GetString(bytes, 0, total);
        int start = text.IndexOf("%%BeginPreview:", StringComparison.Ordinal);
        if (start < 0) return null;

        using var reader = new StringReader(text.Substring(start));
        string declaration = reader.ReadLine();
        if (declaration == null) return null;
        string[] parts = declaration.Substring("%%BeginPreview:".Length)
            .Split((char[])null, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 4 ||
            !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out int width) ||
            !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out int height) ||
            !int.TryParse(parts[2], NumberStyles.None, CultureInfo.InvariantCulture, out int depth) ||
            !int.TryParse(parts[3], NumberStyles.None, CultureInfo.InvariantCulture, out int numberOfLines))
            return null;

        if (width < 1 || height < 1 || width > MaxPreviewDimension ||
            height > MaxPreviewDimension || (long)width * height > MaxPreviewPixels ||
            depth is not (1 or 8 or 24) || numberOfLines < 1 || numberOfLines > MaxEpsiSectionBytes)
            return null;

        int bytesPerRow = checked((width * depth + 7) / 8);
        int expected = checked(bytesPerRow * height);
        if (expected > MaxEpsiSectionBytes / 2) return null;

        byte[] decoded = new byte[expected];
        int index = 0;
        int halfByte = -1;
        for (int lineNumber = 0; lineNumber < numberOfLines && index < expected; lineNumber++) {
            string line = reader.ReadLine();
            if (line == null || line.StartsWith("%%EndPreview", StringComparison.Ordinal)) break;
            foreach (char c in line) {
                if (c == '%' || char.IsWhiteSpace(c)) continue;
                int digit = HexDigit(c);
                if (digit < 0) return null;
                if (halfByte < 0) {
                    halfByte = digit;
                }
                else {
                    decoded[index++] = (byte)((halfByte << 4) | digit);
                    halfByte = -1;
                    if (index == expected) break;
                }
            }
        }
        if (index != expected || halfByte >= 0) return null;

        Bitmap bitmap = new(width, height, PixelFormat.Format24bppRgb);
        BitmapData bits = bitmap.LockBits(new Rectangle(0, 0, width, height),
            ImageLockMode.WriteOnly, PixelFormat.Format24bppRgb);
        try {
            byte[] bgr = new byte[width * 3];
            for (int y = 0; y < height; y++) {
                int row = y * bytesPerRow;
                for (int x = 0; x < width; x++) {
                    int r, g, b;
                    if (depth == 1) {
                        bool marked = (decoded[row + x / 8] & (0x80 >> (x % 8))) != 0;
                        r = g = b = marked ? 0 : 255;
                    }
                    else if (depth == 8) {
                        r = g = b = decoded[row + x];
                    }
                    else {
                        int offset = row + x * 3;
                        r = decoded[offset];
                        g = decoded[offset + 1];
                        b = decoded[offset + 2];
                    }
                    int destination = x * 3;
                    bgr[destination] = (byte)b;
                    bgr[destination + 1] = (byte)g;
                    bgr[destination + 2] = (byte)r;
                }
                Marshal.Copy(bgr, 0, IntPtr.Add(bits.Scan0, y * bits.Stride), bgr.Length);
            }
        }
        catch {
            bitmap.Dispose();
            throw;
        }
        finally {
            bitmap.UnlockBits(bits);
        }
        return bitmap;
    }

    private static int HexDigit(char c) {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        return -1;
    }
}
