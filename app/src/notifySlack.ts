import { SNSEvent, Context } from "aws-lambda";
import axios, { AxiosResponse } from "axios";

const WEBHOOK_URL_PARAMETER = process.env.WEBHOOK_URL_PARAMETER as string;
const ALERT_USERNAME = process.env.ALERT_USERNAME as string;
const ALERT_CHANNEL = process.env.ALERT_CHANNEL as string;
const RDSINSTANCES = process.env.RDSINSTANCES as string;
const RDS_PREFERRED_NAMES = process.env.RDS_PREFERRED_NAMES as string;


// Use a human-readable referred name for alert rather than random string of RDS ID
var rdsIds = RDSINSTANCES.split(',');
var rdsNames = RDS_PREFERRED_NAMES.split(',');
// Combining the two arrays into an object for Instance ID lookup in AlertName string
let rdsAssociations: { [key: string]: string; } = rdsIds.reduce((o, k, i) => ({...o, [k]: rdsNames[i]}), {});

const AWS = require('aws-sdk');
const SSM = new AWS.SSM();
var parameter = {
    "Name" : WEBHOOK_URL_PARAMETER,
    "WithDecryption": true
};

let WEBHOOK_URL: string;
const init = async () => {
    WEBHOOK_URL = (await SSM.getParameter(parameter).promise()).Parameter.Value;
    console.log(typeof WEBHOOK_URL);
  };
const initPromise = init();

export const getFormattedSlackMessage = (snsMessage: string) => {
    try {
        const obj = JSON.parse(snsMessage);
        const { AlarmName, StateChangeTime, NewStateReason, } = obj;
        // Find RDS ID in AlarmName to replace it with the mapping human-readable name if provided
        var newAlarmName = AlarmName;
        Object.keys(rdsAssociations).forEach(key => {
            newAlarmName = newAlarmName.replace(`${key}`, `${rdsAssociations[key]}`);
          });
        // Build Alert message
        return [
            newAlarmName && `*${newAlarmName}*`,
            StateChangeTime && `StateChangeTime: ${StateChangeTime}`,
            NewStateReason && `NewStateReason: ${NewStateReason}`,
            '----------------'
        ].filter(Boolean)
        .join('\n')
    } catch {
        return snsMessage
    }
};

interface NotifySlackOutput {
    event: string,
    ALERT_CHANNEL: string,
    status_code: number
}

const getFormattedMessage = (channel: string, event: SNSEvent) => {
    const { MessageId, Message } = event.Records[0].Sns;
    console.log(`${MessageId} - Sending alert to ${channel}: ${Message}`);
    return getFormattedSlackMessage(Message);
}

const sendAlertToChannel = (channel: string, message: string): Promise<AxiosResponse> => {
    const payload = {
        channel: `#${channel}`,
        username: ALERT_USERNAME,
        text: message,
        icon_emoji: ':rotating_light:'
    };
    return axios.post(WEBHOOK_URL, payload, );
};

export const handler = async (event: SNSEvent, _context: Context): Promise<NotifySlackOutput> => {
    const functionConfig = await initPromise; // just wait until 
    const message = getFormattedMessage(ALERT_CHANNEL, event);
    console.log('Message formatted from event: ', message);
    if(!ALERT_CHANNEL) {
        console.log('No alert channel specified - skipping...');
        return null as any;
    };
    const response = await sendAlertToChannel(ALERT_CHANNEL, message);
    console.log(`Message sent to channel: ${ALERT_CHANNEL}, status: ${response.status}`);
    return {
        event: event.Records[0].Sns.MessageId,
        ALERT_CHANNEL,
        status_code: response.status,
    }
};
