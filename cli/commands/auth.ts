import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { execSync } from 'child_process';
import { MonarchClient } from '../../lib';
import { saveCliConfig, clearCliConfig, loadCliConfig } from '../client';
import { printSuccess, printError, printInfo } from '../utils/output';

const MONARCH_API_URL = 'https://api.monarch.com';

// Headers that Monarch's API expects
function getLoginHeaders(deviceUuid: string): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Client-Platform': 'web',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
    'device-uuid': deviceUuid,
    'Origin': 'https://app.monarchmoney.com',
    'x-cio-client-platform': 'web',
    'x-cio-site-id': '2598be4aa410159198b2',
    'x-gist-user-anonymous': 'false'
  };
}

// Try to fetch OTP from email using gog CLI
async function fetchEmailOTP(account: string, waitSeconds: number = 30): Promise<string | null> {
  const startTime = Date.now();
  const maxWait = waitSeconds * 1000;

  while (Date.now() - startTime < maxWait) {
    try {
      const result = execSync(
        `gog gmail search "from:monarch subject:code" --account ${account} --max 1 --plain 2>/dev/null`,
        { timeout: 15000, encoding: 'utf-8' }
      ).trim();

      // Parse the plain output: ID DATE FROM SUBJECT LABELS THREAD
      const lines = result.split('\n').filter(l => l.trim() && !l.startsWith('ID'));
      if (lines.length > 0) {
        const parts = lines[0].split('\t');
        const subject = parts[3] || '';
        const match = subject.match(/(\d{6})/);
        if (match) {
          // Check if this email is recent (within last 2 minutes)
          const dateStr = parts[1] || '';
          return match[1];
        }
      }
    } catch {
      // gog not available or failed
    }

    // Wait 3 seconds before retrying
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  return null;
}

export const authCommand = new Command('auth')
  .description('Authentication commands');

authCommand
  .command('login')
  .description('Login to Monarch Money (handles email OTP automatically)')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --password <password>', 'Password')
  .option('--mfa-secret <secret>', 'TOTP MFA secret (optional)')
  .option('--otp <code>', 'Email OTP code (if you already have it)')
  .option('--no-auto-otp', 'Do not try to auto-fetch email OTP')
  .action(async (options) => {
    const spinner = ora('Logging in...').start();
    
    try {
      const email = options.email || process.env.MONARCH_EMAIL;
      const password = options.password || process.env.MONARCH_PASSWORD;
      const mfaSecret = options.mfaSecret || process.env.MONARCH_MFA_SECRET;
      
      if (!email || !password) {
        spinner.fail('Email and password required');
        console.log('\nUsage:');
        console.log('  monarch-money auth login -e <email> -p <password>');
        console.log('\nOr set environment variables:');
        console.log('  MONARCH_EMAIL=your@email.com');
        console.log('  MONARCH_PASSWORD=yourpassword');
        process.exit(1);
      }

      const { randomUUID } = await import('crypto');
      const deviceUuid = randomUUID();

      // Build login payload
      const loginData: Record<string, any> = {
        username: email,
        password,
        trusted_device: true,
        supports_mfa: true,
        supports_email_otp: true,
        supports_recaptcha: true
      };

      // Add TOTP if provided
      if (mfaSecret) {
        try {
          const totp = await import('otplib');
          loginData.totp = totp.authenticator.generate(mfaSecret);
        } catch {
          spinner.warn('Could not generate TOTP code');
        }
      }

      // Add email OTP if provided directly
      if (options.otp) {
        loginData.email_otp = options.otp;
      }

      // First login attempt
      const response = await fetch(`${MONARCH_API_URL}/auth/login/`, {
        method: 'POST',
        headers: getLoginHeaders(deviceUuid),
        body: JSON.stringify(loginData)
      });

      const data = await response.json() as any;

      // Handle email OTP requirement
      if (data.error_code === 'EMAIL_OTP_REQUIRED' && !options.otp) {
        spinner.text = 'Email OTP required — checking inbox...';

        let otpCode: string | null = null;

        if (options.autoOtp !== false) {
          // Wait a moment for email delivery, then try to fetch
          await new Promise(resolve => setTimeout(resolve, 5000));
          otpCode = await fetchEmailOTP(email, 30);
        }

        if (!otpCode) {
          spinner.fail('Email OTP required but could not fetch automatically');
          console.log('\nMonarch sent a verification code to your email.');
          console.log('Re-run with the code:');
          console.log(`  monarch-money auth login -e ${email} -p <password> --otp <CODE>`);
          process.exit(1);
        }

        spinner.text = `Got OTP code ${otpCode}, completing login...`;

        // Second request with OTP
        loginData.email_otp = otpCode;
        const otpResponse = await fetch(`${MONARCH_API_URL}/auth/login/`, {
          method: 'POST',
          headers: getLoginHeaders(deviceUuid),
          body: JSON.stringify(loginData)
        });

        const otpData = await otpResponse.json() as any;

        if (!otpData.token) {
          throw new Error(otpData.detail || 'Login failed after OTP submission');
        }

        // Save session
        const client = new MonarchClient({ baseURL: MONARCH_API_URL, enablePersistentCache: false });
        (client as any).sessionStorage?.saveSession(otpData.token, {
          userId: otpData.id,
          email,
          deviceUuid
        });
        saveCliConfig({ email });
        spinner.succeed(`Logged in as ${chalk.cyan(email)} (via email OTP)`);
        return;
      }

      // Handle MFA requirement
      if (response.status === 403 || data.error_code === 'MFA_REQUIRED') {
        throw new Error('MFA required. Provide --mfa-secret or set MONARCH_MFA_SECRET env var.');
      }

      // Handle other errors
      if (response.status >= 400) {
        throw new Error(data.detail || `Login failed (HTTP ${response.status})`);
      }

      // Direct success (no OTP needed)
      if (!data.token) {
        throw new Error('Login failed - no token received');
      }

      const client = new MonarchClient({ baseURL: MONARCH_API_URL, enablePersistentCache: false });
      (client as any).sessionStorage?.saveSession(data.token, {
        userId: data.id,
        email,
        deviceUuid
      });
      saveCliConfig({ email });
      spinner.succeed(`Logged in as ${chalk.cyan(email)}`);
    } catch (error) {
      spinner.fail('Login failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

authCommand
  .command('logout')
  .description('Logout and clear session')
  .action(() => {
    const client = new MonarchClient({ baseURL: MONARCH_API_URL, enablePersistentCache: false });
    client.deleteSession();
    clearCliConfig();
    printSuccess('Logged out successfully');
  });

authCommand
  .command('status')
  .description('Check authentication status')
  .action(async () => {
    const spinner = ora('Checking session...').start();
    
    try {
      const client = new MonarchClient({ baseURL: MONARCH_API_URL, enablePersistentCache: false });
      const loaded = client.loadSession();
      
      if (!loaded) {
        spinner.fail('Not logged in');
        printInfo('Run: monarch auth login');
        return;
      }
      
      // Try a simple API call to verify session
      await client.accounts.getAll();
      
      const config = loadCliConfig();
      const email = config?.email || 'unknown';
      
      spinner.succeed(`Logged in as ${chalk.cyan(email)}`);
    } catch {
      spinner.fail('Session expired or invalid');
      printInfo('Run: monarch auth login');
    }
  });
