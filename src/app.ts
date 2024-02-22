import {ExpressKit} from '@gravity-ui/expresskit';
import {NodeKit} from '@gravity-ui/nodekit';

const nodekit = new NodeKit();

const app = new ExpressKit(nodekit, {
    'GET /': (req, res) => {
        res.send('Hello World!');
    },
});

app.run();
