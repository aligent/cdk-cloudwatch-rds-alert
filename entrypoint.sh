#!/bin/bash

cd /app

# Detect host user identity and address the permission
DOCKER_UID=`stat -c "%u" /home/node/.aws`
DOCKER_GID=`stat -c "%g" /home/node/.aws`

userdel node
groupadd -g ${DOCKER_GID} node
useradd -g ${DOCKER_GID} --home-dir /home/node -s /bin/bash -u ${DOCKER_UID} node

chown -R node:node /home/node/.config
chown -R node:node cdk.context.json cdk.out

echo
echo ╭━━━┳╮╱╱╱╱╱╭╮╭╮
echo ┃╭━╮┃┃╱╱╱╱╭╯╰┫┃
echo ┃┃╱┃┃┃╭━━┳┻╮╭┫┃
echo ┃╰━╯┃┃┃┃━┫╭┫┃╰╯
echo ┃╭━╮┃╰┫┃━┫┃┃╰┳╮
echo ╰╯╱╰┻━┻━━┻╯╰━┻╯
echo 
echo Configure RDS Alerts and Slack Notification
echo 
echo Make sure you have completed the below:
echo 
echo '  1. Bootstrap your environment with CDKv2.x (https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html)'
echo '  2. Create Slack Channel and Incoming Webhook URL (https://api.slack.com/messaging/webhooks)'
echo '  3. Save the Webhook URL in SSM Parameter store as a SecureString (https://docs.aws.amazon.com/systems-manager/latest/userguide/sysman-paramstore-su-create.html)'
echo 
read -p 'Are you ready (y/n)? ' ready
if [[ ! ${ready} =~ ^[Yy]$ ]]; then
    echo Good call!
    exit 1
fi
echo 
read -p '- AWS Profile: ' profile
read -p '- AWS RDS Instance Identifiers (comma-separated with no space in-between): ' instances
read -p '- SSM Parameter for the Webhook URL (e.g. /rds_monitor/webhook): ' webhook
read -p '- Slack Alert Username [RDSAlert] : ' username
username=${username:-RDSAlert}
read -p '- Slack Alert Channel without "#" (Only needed for logging and debugging) : ' channel
echo

if [[ !(${profile} && ${instances} && ${webhook} && ${username} ) ]]; then
    echo "All the parameters need to be provided. Exiting..."
    exit 1;
fi

# Deploy the stack
sudo -u node -- sh -c "\
RDSINSTANCES=${instances} SECURITYGROUP=${sg} WEBHOOK_URL_PARAMETER=${webhook} \
ALERT_USERNAME=${username} ALERT_CHANNEL=${channel} \
cdk deploy --profile ${profile}"