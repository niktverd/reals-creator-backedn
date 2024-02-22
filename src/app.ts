import {ExpressKit} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';
import dotenv from 'dotenv';

import crop from './create-video';

dotenv.config();

const nodekit = new NodeKit();

const dynamicPort = Number(process.env.PORT);
const appPort = isNaN(dynamicPort) ? 3030 : dynamicPort;

const app = new ExpressKit(nodekit, {
    'GET /ping': async (_req, res) => {
        res.send('pong');
    },

    'POST /create-video': async (req, res) => {
        await crop(req, res);
    },
});

app.config = {appPort};
app.run();
