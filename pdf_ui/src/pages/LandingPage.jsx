import React, { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';

// MUI Components
import {
  Box,
  Typography,
  Link,
  List,
  ListItem,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,

} from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import CircularProgress from '@mui/material/CircularProgress';

// MUI Icons
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import CloseIcon from '@mui/icons-material/Close';

// Images
import asuLogo from '../assets/ASU_CIC_LOGO_WHITE.png';
import gradientImg from '../assets/Gradient.svg';
import awsLogo from '../assets/POWERED_BY_AWS.png';
import bottomGradient from '../assets/bottom_gradient.svg';

// Styled Components
import { styled } from '@mui/system';

const StyledLink = styled(Link)(({ theme }) => ({
  color: '#8C1D40',
  textDecoration: 'underline',
  component: 'a',
  '&:hover': {
    color: '#70122F',
  },
}));

const StyledEmailLink = styled(Link)(({ theme }) => ({
  color: '#8C1D40',
  textDecoration: 'none',
  component: 'a',
  '&:hover': {
    color: '#70122F',
    textDecoration: 'underline',
  },
}));

const SmallFiberManualRecordIcon = styled(FiberManualRecordIcon)(({ size }) => ({
  fontSize: size || '8px',
}));

const GradientBox = styled(Box)(({ theme }) => ({
  backgroundImage: `url(${gradientImg})`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  padding: theme.spacing(8),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: theme.spacing(1),
}));

const LandingPage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);

  useEffect(() => {
    if (auth.isLoading) return;
    if (auth.isAuthenticated) {
      navigate('/app', { replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated, navigate]);

  const handleSignIn = () => {
    setLoading(true);
    // Introduce a 1-second delay before redirecting
    setTimeout(() => {
      auth.signinRedirect();
      // No need to reset loading here as redirect will occur
    }, 1000);
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  if (auth.isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={50} thickness={5} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        backgroundColor: '#fff',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Black Bar */}
      <Box
        sx={{
          backgroundColor: '#000',
          height: '36px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />

      {/* Bottom Gradient */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          top: '50%',
          backgroundImage: `url(${bottomGradient})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          zIndex: -1,
        }}
      />

      {/* Black Section with Main Content */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#000',
          color: '#fff',
          minHeight: '65vh',
          alignItems: 'center',
          pb: 4,
          flexGrow: 1,
          flexWrap: 'wrap',
        }}
      >
        {/* Left Side: Text */}
        <Box
          sx={{
            flex: 1,
            padding: '0 4%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            minWidth: '300px',
          }}
        >
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 2 }}>
            PDF Accessibility Remediation
          </Typography>

          <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium', mb: 2 }}>
            About this solution:
          </Typography>
          <Typography variant="body1" component="h3" paragraph>
            This solution was created by the Arizona State University Artificial
            Intelligence Cloud Innovation Center (AI CIC), powered by Amazon Web
            Services (AWS), to tackle a significant challenge in the digital era:
            improving the accessibility of digital document collections.
          </Typography>
          <Typography variant="body1" component="h3" paragraph>
            With the Department of Justice’s April 2024 updates to how the
            Americans with Disabilities Act (ADA) will be regulated, the AI CIC
            developed a scalable open‐source solution that quickly and
            efficiently brings PDF documents into compliance with WCAG 2.1 Level
            AA standards. For bulk processing, 10 pages would cost approximately
            $0.013 for AWS service costs + Adobe API costs.
          </Typography>
          <Typography variant="body1" component="h3" paragraph>
            To test out this open‐source solution,{' '}
            <Box component="span" sx={{ color: '#FFC627', fontWeight: 'bold' }}>
              click the button to the right
            </Box>{' '}
            to briefly create an account, upload your document, and receive your
            remediated PDF in return.
          </Typography>

          {/* Provided By Section */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mt: 4,
            }}
          >
            <Typography variant="body1" component="h3" sx={{ mr: 1, fontWeight: 'bold' }}>
              Provided by:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <img
                src={asuLogo}
                alt="ASU AI CIC Logo (white)"
                style={{ height: 70, width: 'auto', marginRight: '16px' }}
              />
              <img
                src={awsLogo}
                alt="Powered by AWS logo (white)"
                style={{ height: 40, width: 'auto' }}
              />
            </Box>
          </Box>
        </Box>

        {/* Right Side: Gradient + Button + Link in the black area */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column', // Column so the link can appear below the gradient box
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            minWidth: '300px',
          }}
        >
          {/* Gradient box with the button */}
          <GradientBox>
            <Typography
              variant="h5"
              component="h2"
              sx={{
                mb: 4,
                color: '#FFC627',
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              READY TO TRANSFORM YOUR PDF?
            </Typography>
            <LoadingButton
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIosIcon />}
              onClick={handleSignIn}
              loading={loading}
              component="button"
              loadingIndicator={
                <CircularProgress
                  size={24}
                  sx={{ color: '#000' }}
                />
              }
              sx={{
                backgroundColor: '#FFC627',
                color: '#000',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                width: 350,
                height: 50,
                overflow: 'hidden',
                position: 'relative',
                borderRadius: '25px',
                transition: 'transform 0.2s, background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  backgroundColor: '#e6ae22',
                  transform: 'scale(1.05)',
                },
                '&.MuiLoadingButton-loading': {
                  backgroundColor: '#FFC627',
                },
              }}
            >
              Login and Remediate My PDF
            </LoadingButton>
          </GradientBox>

          {/* Link placed outside the GradientBox but still in the black area */}
          <Box sx={{ mt: 2 }}>
            <StyledLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleOpenDialog();
              }}
              sx={{ fontSize: '0.9rem', color: '#FFC627' }}
            >
              Learn more about the remediation process
            </StyledLink>
          </Box>
        </Box>
      </Box>

      {/* Thin Yellow Line */}
      <Box
        sx={{
          height: '5px',
          backgroundColor: '#FFC627',
        }}
      />

      {/* Support Resources Section */}
      <Box
        sx={{
          p: 4,
          borderTop: '1px solid #ddd',
          borderBottom: '1px solid #ddd',
        }}
      >
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          Support resources:
        </Typography>
        <List>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemIcon sx={{ minWidth: '24px' }}>
              <SmallFiberManualRecordIcon size="12px" sx={{ color: '#000000' }} />
            </ListItemIcon>
            <Typography variant="body1" component="h3">
            Want a personalized demo of this solution? Have questions about your customer setup?{' '}
              <StyledLink
                href="https://aws.amazon.com/government-education/contact/"
                target="_blank"
                rel="noopener"
                sx={{ ml: 0.5 }}
              >
                Contact AWS
              </StyledLink>
            </Typography>
          </ListItem>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemIcon sx={{ minWidth: '24px' }}>
              <SmallFiberManualRecordIcon size="12px" sx={{ color: '#000000' }} />
            </ListItemIcon>
            <Typography variant="body1" component="h3">
            Watch a recorded demo and review technical architecture:{' '}
              <StyledLink
                href="https://youtu.be/BFGN7tC1trA?si=uGGEifk22UrAR8fJ"
                target="_blank"
                rel="noopener"
                sx={{ ml: 0.5 }}
              >
                Watch Demo
              </StyledLink>
            </Typography>
          </ListItem>
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemIcon sx={{ minWidth: '24px' }}>
              <SmallFiberManualRecordIcon size="12px" sx={{ color: '#000000' }} />
            </ListItemIcon>
            <Typography variant="body1" component="h3">
              This solution is available open source and can be added to your
              AWS account for usage and testing.
              <StyledLink
                href="https://github.com/ASUCICREPO/PDF_Accessibility"
                target="_blank"
                rel="noopener"
                sx={{ ml: 0.5 }}
              >
                Review documentation and access the GitHub repo.
              </StyledLink>
            </Typography>
          </ListItem>
          <ListItem disablePadding>
            <ListItemIcon sx={{ minWidth: '24px' }}>
              <SmallFiberManualRecordIcon size="12px" sx={{ color: '#000000' }} />
            </ListItemIcon>
            <Typography variant="body1" component="h3">
              Have questions about the AI CIC or need support? Email us:{' '}
              <StyledEmailLink href="mailto:ai-cic@amazon.com">
                ai-cic@amazon.com
              </StyledEmailLink>
            </Typography>
          </ListItem>
        </List>
      </Box>

      {/* About the AI CIC Section */}
      <Box
        sx={{
          p: 4,
          backgroundColor: '#FAFAFA',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '120%',
            height: '150%',
            backgroundImage: `url(${bottomGradient})`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            transform: 'rotate(-15deg)',
            opacity: 0.2,
            zIndex: -1,
          }}
        />
        <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
          About the AI CIC:
        </Typography>
        <Typography variant="body1" component="h3" paragraph>
          The ASU Artificial Intelligence Cloud Innovation Center (AI CIC),
          powered by AWS, is a no‐cost design thinking and rapid prototyping
          shop dedicated to bridging the digital divide and driving innovation
          in the nonprofit, healthcare, education, and government sectors.
        </Typography>
        <Typography variant="body1" component="h3" paragraph>
          Our expert team harnesses Amazon’s pioneering approach to dive deep
          into high-priority pain points, meticulously define challenges, and
          craft strategic solutions. We collaborate with AWS solutions
          architects and talented student workers to develop tailored
          prototypes showcasing how advanced technology can tackle a wide
          range of operational and mission-related challenges.
        </Typography>
        <Typography variant="body1" component="h3" paragraph>
          Discover how we use technology to drive innovation. Visit our
          website at{' '}
          <StyledLink
            href="https://smartchallenges.asu.edu/challenges/pdf-accessibility-ohio-state-university"
            target="_blank"
            rel="noopener"
          >
            AI CIC
          </StyledLink>{' '}
          or contact us directly at{' '}
          <StyledEmailLink href="mailto:ai-cic@amazon.com">
            ai-cic@amazon.com
          </StyledEmailLink>
          .
        </Typography>
      </Box>

      {/* 
        Dialog (modal) for remediation process
      */}
      <Dialog
  open={openDialog}
  onClose={handleCloseDialog}
  aria-labelledby="remediation-dialog-title"
>
  <DialogTitle
    id="remediation-dialog-title"
    sx={{ pr: 4, position: 'relative' }}
  >
    <strong>Remediation Process</strong>
    <IconButton
      aria-label="close"
      onClick={handleCloseDialog}
      sx={{
        position: 'absolute',
        right: 8,
        top: 8,
        color: (theme) => theme.palette.grey[500],
      }}
    >
      <CloseIcon />
    </IconButton>
  </DialogTitle>

  <DialogContent dividers>
    <Typography variant="body1" component="p"  paragraph>
      Here’s how our PDF Remediation process works:
    </Typography>

    <Typography variant="body2" component="p" paragraph>
      1. <strong>Upload a Document:</strong> Once you are logged in,
      simply select a PDF to upload for remediation.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      2. <strong>Remediation:</strong> We use an automated approach,
      supported by Adobe’s API and AWS services, to fix common accessibility
      issues like missing tags, incorrect reading order, Alt Text and more.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      3. <strong>Download Your Accessible PDF:</strong> Within a short
      time, you’ll receive your remediated PDF and accessiblity reports ready to share with
      everyone.
    </Typography>

    {/* Additional Restrictions Section */}
    <Typography variant="body1" component="p" paragraph sx={{ mt: 2 }}>
      <strong>Please note the following restrictions before uploading:</strong>
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      1. Each user is limited to <strong>3</strong> PDF document uploads.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      2. Documents cannot exceed <strong>10</strong> pages.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      3. Documents must be smaller than <strong>25</strong> MB.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      4. Do not upload documents containing sensitive information.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      5. This solution only remediates PDF documents. Other document types will not be accepted.
    </Typography>
    <Typography variant="body2" component="p" paragraph>
      6. This solution does not remediate fillable forms or handle color selection/contrast.
    </Typography>
    <Typography variant="body1" component="p" paragraph>
      This solution is <em>open source</em> and can be deployed in your
      own AWS environment. Check out{' '}
      <StyledLink
                href="https://github.com/ASUCICREPO/PDF_Accessibility"
                target="_blank"
                rel="noopener"
                sx={{ ml: 0.5 }}
              >
                Github
      </StyledLink>
    </Typography>
  </DialogContent>
</Dialog>
    </Box>
  );
};

export default LandingPage;
