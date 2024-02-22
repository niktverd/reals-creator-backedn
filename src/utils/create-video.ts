import {resolve as pathResolve} from 'path';

import videoshow from 'videoshow';

import {templates} from '../templates';

const getVideoOptions = (width: number, height: number) => ({
    fps: 60,
    transition: false,
    videoBitrate: 1024,
    videoCodec: 'libx264',
    size: `${width}x${height}`,
    outputOptions: ['-pix_fmt yuv420p'],
    format: 'mp4',
});

export const createVideo = ({
    imageFiles,
    folder,
    template = 'first',
    width,
    height,
}: {
    imageFiles: string[];
    folder: string;
    template: string;
    width: number;
    height: number;
}): Promise<string> => {
    return new Promise((resolve, reject) => {
        const images = templates[template].images.map((piece: object, index: number) => {
            return {...piece, path: imageFiles[index]};
        });

        const soundPath = templates[template].sound;
        const pathResolved = pathResolve(__dirname, '../../assets/audio', soundPath);
        const videoOptions = getVideoOptions(width, height);

        videoshow(images, videoOptions)
            .audio(pathResolved, {fade: false})
            .save(pathResolve(folder, 'output.mp4'))
            .on('start', function (command: string) {
                // eslint-disable-next-line no-console
                console.log('encoding ' + folder + ' with command ' + command);
            })
            .on('error', function (err: string) {
                reject(new Error(err));
            })
            .on('end', function (output: string) {
                resolve(output);
            });
    });
};
