import React, { useState, useEffect } from 'react';
import { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { Box, Typography, CircularProgress } from '@mui/material';
import awsconfig from '../aws-exports';

const QueryCloudwatch = ({ filename, onStatusChange }) => {
  const [status, setStatus] = useState('Processing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLogData = async () => {
      try {
        const client = new CloudWatchLogsClient({
          region: awsconfig.aws_project_region,
          credentials: fromCognitoIdentityPool({
            clientConfig: { region: awsconfig.aws_project_region },
            identityPoolId: awsconfig.aws_cognito_identity_pool_id,
          }),
        });

        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 24);
        const endTime = new Date();

        const queryString = `
          fields @timestamp, @message
          | parse @message "File: *, Status: *" as file, status
          | filter file = '${filename}'
          | stats latest(status) as latestStatus by file
          | sort @timestamp desc
          | limit 1
        `;

        const logGroups = [
          '/aws/lambda/PDFAccessibility-SplitPDFE6095B5B-tQqivRQB5F0e',
          '/aws/lambda/PDFAccessibility-JavaLambda0B0D5A40-dw1lTvBnS6Jv',
          '/ecs/MyFirstTaskDef/python_container',
          '/ecs/MySecondTaskDef/javascript_container'
        ];

        const startQueryCommands = logGroups.map(logGroup => new StartQueryCommand({
          logGroupName: logGroup,
          startTime: startTime.getTime(),
          endTime: endTime.getTime(),
          queryString: queryString,
        }));

        const startQueryResponses = await Promise.all(startQueryCommands.map(command => client.send(command)));
        const queryIds = startQueryResponses.map(response => response.queryId);

        const checkResults = async () => {
          try {
            const getResultsCommands = queryIds.map(queryId => new GetQueryResultsCommand({ queryId }));
            const results = await Promise.all(getResultsCommands.map(command => client.send(command)));

            const completedResults = results.filter(result => result.status === 'Complete' && result.results.length > 0);

            if (completedResults.length > 0) {
              const latestResult = completedResults.reduce((latest, current) => {
                return new Date(current.results[0][0].value) > new Date(latest.results[0][0].value) ? current : latest;
              });

              const latestStatus = latestResult.results[0][0].value;
              setStatus(latestStatus);
              setLoading(false);

              if (latestStatus.includes('Failed in First ECS task')) {
                setError('Adobe credentials usage exhausted');
                onStatusChange('error');
              } else if (latestStatus.includes('Error in second ECS task')) {
                setError('Failed to generate ALT text');
                onStatusChange('error');
              } else if (latestStatus.includes('succeeded')) {
                onStatusChange('success');
                return; // Stop querying when succeeded
              } else {
                onStatusChange(latestStatus);
              }
            } else if (results.every(result => result.status === 'Failed')) {
              setError('Query failed');
              setLoading(false);
            } else {
              setTimeout(checkResults, 10000); // Retry after 10 seconds
            }
          } catch (err) {
            if (err.name === 'ThrottlingException') {
              console.warn('Rate limit exceeded, retrying in 10 seconds');
              setTimeout(checkResults, 10000);
            } else {
              throw err;
            }
          }
        };

        checkResults();
      } catch (err) {
        console.error("Error querying CloudWatch logs:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    const intervalId = setInterval(fetchLogData, 10000); // Query every 10 seconds

    return () => clearInterval(intervalId);
  }, [filename, onStatusChange]);

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">Error: {error}</Typography>;
  }

  return (
    <Box>
      <Typography variant="h6">File Status</Typography>
      <Typography>Filename: {filename}</Typography>
      <Typography>Status: {status}</Typography>
    </Box>
  );
};

export default QueryCloudwatch;










