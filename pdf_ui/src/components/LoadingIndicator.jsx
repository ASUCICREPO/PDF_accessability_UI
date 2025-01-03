import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

function LoadingIndicator({ message = 'Loading...' }) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <CircularProgress />
      <Typography variant="h6" color="textSecondary">
        {message}
      </Typography>
    </Box>
  );
}

export default LoadingIndicator;