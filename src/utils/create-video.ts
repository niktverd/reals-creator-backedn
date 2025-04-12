/* eslint-disable no-console */
import {accessSync, constants, existsSync, mkdirSync} from 'fs';
import {join} from 'path';

import ffmpeg from 'fluent-ffmpeg';

import {templates} from '../templates';

// Common ffmpeg event handlers
const setupFfmpegEvents = (
    command: ffmpeg.FfmpegCommand,
    resolve: (output: string) => void,
    reject: (error: Error) => void,
    outputPath: string,
) => {
    command
        .on('start', (commandLine: string) => {
            console.log('Encoding with command:', commandLine);
        })
        .on('error', (err: Error) => {
            console.log('err:', err);
            reject(err);
        })
        .on('progress', (progress) => {
            console.log(`Processing: ${progress}% done`);
        })
        .on('stderr', (stderrLine) => {
            console.log(2, 'FFmpeg stderr:', stderrLine);
        })
        .on('end', () => {
            resolve(outputPath);
        });
};

// Verify that the directory is writable
const ensureDirectoryExists = (dirPath: string): boolean => {
    try {
        // First check if directory exists
        if (!existsSync(dirPath)) {
            console.log(`Directory ${dirPath} does not exist, creating it...`);
            mkdirSync(dirPath, {recursive: true});
        }

        try {
            // Check if directory is writable
            accessSync(dirPath, constants.W_OK);
            console.log(`Directory ${dirPath} is writable`);
            return true;
        } catch (err) {
            console.error(`Directory ${dirPath} is not writable:`, err);
            return false;
        }
    } catch (err) {
        console.error(`Error creating directory ${dirPath}:`, err);
        return false;
    }
};

export const createVideo = ({
    imageFiles,
    folder,
    template = 'first',
    width,
    height,
    paidUser,
}: {
    imageFiles: string[];
    folder: string;
    template: string;
    width: number;
    height: number;
    paidUser: boolean;
}): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Debug input params
        console.log('Create video params:', {folder, template, width, height, paidUser});
        console.log('Image files count:', imageFiles.length);

        // Ensure the output directory exists and is writable
        if (!ensureDirectoryExists(folder)) {
            reject(new Error(`Unable to write to directory: ${folder}`));
            return;
        }

        // Get template configuration
        const templateConfig = templates[template];
        const soundPath = join(process.cwd(), 'assets/audio', templateConfig.sound);
        const outputPath = join(folder, 'output.mp4');

        console.log(`Creating video at: ${outputPath}`);

        try {
            // Create our ffmpeg command
            const command = ffmpeg();

            // Build the filter complex manually for better control
            let filterComplex = '';
            const validImages = [];

            // Add each image as input with its loop duration
            const templateImages = [...templateConfig.images];
            if (!paidUser) {
                templateImages.push({loop: 3, path: ''});
            }

            // Process each image according to template configuration
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            templateImages.forEach((imgConfig: any, index: number) => {
                if (imageFiles[index] && imageFiles[index].trim() !== '') {
                    const duration = imgConfig.loop || 5; // Default to 5 seconds if not specified

                    // Add input with loop and duration
                    command
                        .input(imageFiles[index])
                        .inputOptions(['-loop', '1'])
                        .inputOption('-t', String(duration));

                    validImages.push(index);

                    // Add setsar filter for each input to ensure consistent SAR
                    filterComplex += `[${validImages.length - 1}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1:1[v${validImages.length - 1}];`;
                }
            });

            // Add audio input
            command.input(soundPath);

            // Concat all prepared video streams
            if (validImages.length > 0) {
                const inputs = Array.from({length: validImages.length}, (_, i) => `[v${i}]`).join(
                    '',
                );
                filterComplex += `${inputs}concat=n=${validImages.length}:v=1:a=0[vout];`;
                filterComplex += '[vout]format=yuv420p[outv]';

                command.complexFilter(filterComplex);

                // Configure output
                command.outputOptions([
                    '-map',
                    '[outv]',
                    '-map',
                    `${validImages.length}:a`,
                    '-c:v',
                    'libx264',
                    '-c:a',
                    'aac',
                    '-r',
                    '60',
                    '-b:v',
                    '1024k',
                    '-shortest',
                ]);
            }

            // Set output file
            command.output(outputPath).outputOption('-y');

            // Setup event handlers
            setupFfmpegEvents(command, resolve, reject, outputPath);

            // Run the command
            command.run();
        } catch (error) {
            console.error('Error creating video:', error);
            reject(error);
        }
    });
};
