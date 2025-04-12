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
            // eslint-disable-next-line no-console
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

        // Create a new ffmpeg command
        const command = ffmpeg();

        // Add each image as input with its loop duration
        const templateImages = [...templateConfig.images];
        if (!paidUser) {
            templateImages.push({loop: 3, path: ''});
        }

        // Process each image according to template configuration
        const validImages: {index: number; duration: number}[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        templateImages.forEach((imgConfig: any, index: number) => {
            if (imageFiles[index] && imageFiles[index].trim() !== '') {
                const duration = imgConfig.loop || 5; // Default to 5 seconds if not specified
                command.input(imageFiles[index]).inputOptions([`-loop 1`, `-t ${duration}`]);
                validImages.push({index, duration});
            }
        });

        // Add audio
        command.input(soundPath);

        // Setup complex filter for concatenating the images into a video
        const filterInputs: string[] = [];
        const filterOutputs: string[] = [];

        // Create filter inputs and outputs for each valid image
        validImages.forEach((img, i) => {
            filterInputs.push(
                `[${img.index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
            );
            filterOutputs.push(`[v${i}]`);
        });

        // Concatenate all video streams
        if (filterOutputs.length > 0) {
            const concatFilter = `${filterOutputs.join('')}concat=n=${filterOutputs.length}:v=1:a=0[outv]`;
            const complexFilter = [...filterInputs, concatFilter].join(';');

            command.complexFilter(complexFilter);

            // Map the output video and audio streams
            command.outputOptions([
                '-map [outv]',
                `-map ${validImages.length}:a`, // Audio is the last input
                '-c:v libx264',
                '-c:a aac',
                '-pix_fmt yuv420p',
                '-r 60', // fps
                '-b:v 1024k', // video bitrate
                '-shortest', // End when shortest input stream ends
            ]);
        }

        // Use a simple output option to avoid conflicts
        command.output(outputPath).outputOption('-y');

        // Setup event handlers
        setupFfmpegEvents(command, resolve, reject, outputPath);

        // Execute the command
        command.run();
    });
};
