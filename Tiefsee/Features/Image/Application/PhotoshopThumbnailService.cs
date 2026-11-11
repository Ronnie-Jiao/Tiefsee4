using System.Buffers.Binary;
using System.IO;

namespace Tiefsee;

/// <summary>
/// Reads the pre-rendered Photoshop Image Resource 1036 (or older 1033)
/// without decompressing layers or the full merged document. This is a
/// thumbnail, NOT a replacement for the full PSD/PSB composite renderer.
/// </summary>
public static class PhotoshopThumbnailService {
    private const long MaxResourceSectionBytes = 256L * 1024 * 1024;
    private const int MaxEmbeddedJpegBytes = 24 * 1024 * 1024;
    private const int HeaderLength = 26;

    public static byte[] TryReadEmbeddedJpeg(string path) {
        using var input = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        if (input.Length < HeaderLength + 8) return null;

        using var reader = new BinaryReader(input);
        if (ReadAscii(reader, 4) != "8BPS") return null;
        ushort version = ReadUInt16(reader);
        if (version != 1 && version != 2) return null;
        input.Position = HeaderLength;

        uint colorModeLength = ReadUInt32(reader);
        if ((long)colorModeLength > input.Length - input.Position) return null;
        input.Position += colorModeLength;

        if (input.Length - input.Position < 4) return null;
        uint imageResourceLength = ReadUInt32(reader);
        if (imageResourceLength > MaxResourceSectionBytes ||
            imageResourceLength > input.Length - input.Position) return null;

        long sectionEnd = input.Position + imageResourceLength;
        byte[] legacyThumbnail = null;
        while (input.Position <= sectionEnd - 12) {
            if (ReadAscii(reader, 4) != "8BIM") break;
            ushort id = ReadUInt16(reader);

            // Photoshop resource names are Pascal strings, even-byte padded.
            int nameLength = reader.ReadByte();
            int nameBytes = nameLength + ((nameLength + 1) % 2);
            if (nameBytes > sectionEnd - input.Position) return legacyThumbnail;
            input.Position += nameBytes;

            if (sectionEnd - input.Position < 4) break;
            uint dataLength = ReadUInt32(reader);
            long next = input.Position + (long)dataLength + (dataLength % 2);
            if (next > sectionEnd) break;

            if ((id == 1036 || id == 1033) &&
                dataLength >= 28 && dataLength <= MaxEmbeddedJpegBytes + 28) {
                long start = input.Position;
                uint format = ReadUInt32(reader);
                uint width = ReadUInt32(reader);
                uint height = ReadUInt32(reader);
                input.Position = start + 20;
                uint compressedSize = ReadUInt32(reader);
                input.Position = start + 28;

                if (format == 1 && width > 0 && height > 0 &&
                    width <= 16384 && height <= 16384 &&
                    compressedSize >= 4 && compressedSize <= dataLength - 28 &&
                    compressedSize <= MaxEmbeddedJpegBytes) {
                    byte[] jpeg = reader.ReadBytes((int)compressedSize);
                    if (jpeg.Length == compressedSize && jpeg[0] == 0xFF && jpeg[1] == 0xD8) {
                        if (id == 1036) return jpeg; // modern quality thumbnail
                        legacyThumbnail ??= jpeg;
                    }
                }
            }
            input.Position = next;
        }
        return legacyThumbnail;
    }

    private static string ReadAscii(BinaryReader reader, int count) =>
        System.Text.Encoding.ASCII.GetString(reader.ReadBytes(count));

    private static ushort ReadUInt16(BinaryReader reader) {
        Span<byte> data = stackalloc byte[2];
        reader.ReadExactly(data);
        return BinaryPrimitives.ReadUInt16BigEndian(data);
    }

    private static uint ReadUInt32(BinaryReader reader) {
        Span<byte> data = stackalloc byte[4];
        reader.ReadExactly(data);
        return BinaryPrimitives.ReadUInt32BigEndian(data);
    }
}
