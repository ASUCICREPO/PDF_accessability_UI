import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Typography, Box, CircularProgress, Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import DescriptionIcon from '@mui/icons-material/Description';
import HtmlIcon from '@mui/icons-material/Html';
import { JobHistoryAPI, region, PRIMARY_MAIN, SECONDARY_MAIN } from '../utilities/constants';

const statusConfig = {
  complete: { label: 'Complete', color: 'success' },
  processing: { label: 'Processing', color: 'warning' },
  failed: { label: 'Failed', color: 'error' },
};

export default function JobHistory({ awsCredentials }) {
  const auth = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    if (!JobHistoryAPI || !auth.user?.id_token) return;
    setLoading(true);
    try {
      const res = await fetch(JobHistoryAPI, {
        headers: { Authorization: `Bearer ${auth.user.id_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id_token]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleDownload = async (job) => {
    if (!awsCredentials || !job.s3_result_key) return;
    try {
      const s3 = new S3Client({
        region,
        credentials: {
          accessKeyId: awsCredentials.accessKeyId,
          secretAccessKey: awsCredentials.secretAccessKey,
          sessionToken: awsCredentials.sessionToken,
        },
      });
      const command = new GetObjectCommand({
        Bucket: job.s3_bucket,
        Key: job.s3_result_key,
        ResponseContentDisposition: `attachment; filename="${job.filename}"`,
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 30000 });
      window.open(url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: PRIMARY_MAIN }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>My Documents</Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchJobs} sx={{ color: PRIMARY_MAIN }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {jobs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No documents yet. Upload a PDF to get started.
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: PRIMARY_MAIN }}>
                {['File', 'Format', 'Pages', 'Status', 'Date', 'Download'].map((h) => (
                  <TableCell key={h} sx={{ color: '#fff', fontWeight: 600 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => {
                const status = statusConfig[job.status] || statusConfig.processing;
                return (
                  <TableRow key={job.created_at} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {job.format === 'html'
                          ? <HtmlIcon sx={{ color: SECONDARY_MAIN }} />
                          : <DescriptionIcon sx={{ color: PRIMARY_MAIN }} />}
                        <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                          {job.filename}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={job.format === 'html' ? 'HTML' : 'PDF'}
                        size="small"
                        sx={{
                          backgroundColor: job.format === 'html' ? SECONDARY_MAIN : PRIMARY_MAIN,
                          color: '#fff',
                        }}
                      />
                    </TableCell>
                    <TableCell>{job.page_count || '—'}</TableCell>
                    <TableCell>
                      <Chip label={status.label} color={status.color} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{formatDate(job.created_at)}</TableCell>
                    <TableCell>
                      {job.status === 'complete' && job.s3_result_key ? (
                        <Tooltip title="Download">
                          <IconButton onClick={() => handleDownload(job)} sx={{ color: PRIMARY_MAIN }}>
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                      ) : job.status === 'processing' ? (
                        <CircularProgress size={20} sx={{ color: SECONDARY_MAIN }} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
