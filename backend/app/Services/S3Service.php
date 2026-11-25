<?php

namespace App\Services;

use Aws\S3\S3Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class S3Service
{
    /**
     * Generate a presigned URL or storage URL for an object.
     *
     * @param string $s3Url The full S3 URL or relative key/path.
     * @param string $expiration How long the URL should be valid (e.g., '+15 minutes').
     * @return string|null The signed or public URL, or null on failure.
     */
    public static function getSignedUrl(string $s3Url, string $expiration = '+15 minutes'): ?string
    {
        try {
            // Parse the URL to extract the key/path
            $parsedUrl = parse_url($s3Url);
            $key = ltrim($parsedUrl['path'] ?? '', '/');

            if (empty($key)) {
                return null;
            }

            $diskName = config('filesystems.default', 'public');
            $disk = Storage::disk($diskName);

            // If using S3 and AWS credentials exist, create presigned request
            if ($diskName === 's3' && config('filesystems.disks.s3.key')) {
                $s3Client = new S3Client([
                    'region' => config('filesystems.disks.s3.region', 'ap-south-1'),
                    'version' => 'latest',
                    'credentials' => [
                        'key'    => config('filesystems.disks.s3.key'),
                        'secret' => config('filesystems.disks.s3.secret')
                    ]
                ]);

                $cmd = $s3Client->getCommand('GetObject', [
                    'Bucket' => config('filesystems.disks.s3.bucket'),
                    'Key' => $key,
                ]);

                $request = $s3Client->createPresignedRequest($cmd, $expiration);
                return (string) $request->getUri();
            }

            // Fallback for public disk, local disk, or non-S3 storage
            return $disk->url($key);
        } catch (\Throwable $e) {
            Log::warning('Error generating storage/signed URL: ' . $e->getMessage());
            return null;
        }
    }
}
