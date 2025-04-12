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
            reject(err);
        })
        .on('end', () => {
            resolve(outputPath);
        });
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
        // Get template configuration
        const templateConfig = templates[template];
        const soundPath = join(process.cwd(), 'assets/audio', templateConfig.sound);
        const outputPath = join(folder, 'output.mp4');

        // Create a new ffmpeg command
        const command = ffmpeg();

        // Add each image as input with its loop duration
        const templateImages = [...templateConfig.images];
        if (!paidUser) {
            templateImages.push({loop: 3, path: ''});
        }

        // Process each image according to template configuration
        templateImages.forEach((imgConfig: any, index: number) => {
            if (imageFiles[index]) {
                const duration = imgConfig.loop || 5; // Default to 5 seconds if not specified
                command.input(imageFiles[index]).inputOptions([`-loop 1`, `-t ${duration}`]);
            }
        });

        // Add audio
        command.input(soundPath);

        // Setup complex filter for concatenating the images into a video
        const filterInputs: string[] = [];
        const filterOutputs: string[] = [];

        // Create filter inputs and outputs for each image
        for (let i = 0; i < templateImages.length; i++) {
            if (imageFiles[i]) {
                filterInputs.push(
                    `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`,
                );
                filterOutputs.push(`[v${i}]`);
            }
        }

        // Concatenate all video streams
        if (filterOutputs.length > 0) {
            const concatFilter = `${filterOutputs.join('')}concat=n=${filterOutputs.length}:v=1:a=0[outv]`;
            const complexFilter = [...filterInputs, concatFilter].join(';');

            command.complexFilter(complexFilter);

            // Map the output video and audio streams
            command
                .outputOptions([
                    '-map [outv]',
                    `-map ${templateImages.length}:a`,
                    '-c:v libx264',
                    '-c:a aac',
                    '-pix_fmt yuv420p',
                    '-r 60', // fps
                    '-b:v 1024k', // video bitrate
                    '-shortest', // End when shortest input stream ends
                ])
                .size(`${width}x${height}`);
        }

        // Set output file
        command.save(outputPath);

        // Setup event handlers
        setupFfmpegEvents(command, resolve, reject, outputPath);
    });
};
