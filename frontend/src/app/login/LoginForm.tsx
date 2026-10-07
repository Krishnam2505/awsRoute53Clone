'use client';

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import Container from '@cloudscape-design/components/container';
import Form from '@cloudscape-design/components/form';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import Link from '@cloudscape-design/components/link';
import RadioGroup from '@cloudscape-design/components/radio-group';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import { errorMessage, useLogin } from '@/lib/api';

type LoginType = 'root' | 'iam';

const DEMO = { accountId: '123456789012', username: 'demo', password: 'demo1234' };
const REMEMBER_KEY = 'r53-remember-account';

function safeNext(next: string | null): string {
  // Only same-site paths, never '//evil.com'
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/route53/v2/hostedzones';
}

/** Mock AWS sign-in: root user or IAM user, checked against the seeded demo accounts. */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [loginType, setLoginType] = useState<LoginType>('iam');
  const [accountId, setAccountId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REMEMBER_KEY);
      if (stored) {
        setAccountId(stored);
        setRemember(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const fillDemo = () => {
    setLoginType('iam');
    setAccountId(DEMO.accountId);
    setUsername(DEMO.username);
    setPassword(DEMO.password);
    setErrors({});
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const next: Record<string, string> = {};
    if (loginType === 'iam' && !accountId.trim()) next.accountId = 'Enter your account ID.';
    if (!username.trim()) next.username = 'Enter your user name.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    login.mutate(
      {
        login_type: loginType,
        account_id: loginType === 'iam' ? accountId.trim() : null,
        username: username.trim(),
        password,
      },
      {
        onSuccess: () => {
          try {
            if (remember && loginType === 'iam') {
              window.localStorage.setItem(REMEMBER_KEY, accountId.trim());
            } else {
              window.localStorage.removeItem(REMEMBER_KEY);
            }
          } catch {
            // ignore
          }
          router.replace(safeNext(searchParams.get('next')));
        },
      },
    );
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/console-logo.svg" alt="" width={24} height={24} />
          <Box variant="h3" tagOverride="span">
            Route 53 Console
          </Box>
        </div>
        <form onSubmit={submit} noValidate>
          <Container header={<Header variant="h1">Sign in</Header>}>
            <Form
              actions={
                <Button variant="primary" formAction="submit" loading={login.isPending} fullWidth>
                  Sign in
                </Button>
              }
            >
              <SpaceBetween size="l">
                {login.isError && (
                  <Alert type="error" header="Your authentication information is incorrect.">
                    {errorMessage(login.error)}
                  </Alert>
                )}
                <RadioGroup
                  value={loginType}
                  onChange={({ detail }) => setLoginType(detail.value as LoginType)}
                  items={[
                    {
                      value: 'root',
                      label: 'Root user',
                      description:
                        'Account owner that performs tasks requiring unrestricted access.',
                    },
                    {
                      value: 'iam',
                      label: 'IAM user',
                      description: 'User within an account that performs daily tasks.',
                    },
                  ]}
                />
                {loginType === 'iam' && (
                  <FormField
                    label="Account ID (12 digits) or account alias"
                    errorText={errors.accountId}
                  >
                    <Input
                      value={accountId}
                      onChange={({ detail }) => setAccountId(detail.value)}
                      autoComplete="username"
                      inputMode="numeric"
                      autoFocus
                    />
                  </FormField>
                )}
                <FormField
                  label={loginType === 'iam' ? 'IAM user name' : 'Root user name'}
                  errorText={errors.username}
                >
                  <Input
                    value={username}
                    onChange={({ detail }) => setUsername(detail.value)}
                    autoComplete="username"
                  />
                </FormField>
                <FormField label="Password" errorText={errors.password}>
                  <Input
                    type="password"
                    value={password}
                    onChange={({ detail }) => setPassword(detail.value)}
                    autoComplete="current-password"
                  />
                </FormField>
                {loginType === 'iam' && (
                  <Checkbox
                    checked={remember}
                    onChange={({ detail }) => setRemember(detail.checked)}
                  >
                    Remember this account
                  </Checkbox>
                )}
              </SpaceBetween>
            </Form>
          </Container>
        </form>
        <Box margin={{ top: 'l' }}>
          <Alert
            type="info"
            header="Demo credentials"
            action={<Button onClick={fillDemo}>Use demo account</Button>}
          >
            Account ID <b>{DEMO.accountId}</b>, IAM user name <b>{DEMO.username}</b>, password{' '}
            <b>{DEMO.password}</b>. A second account (<b>alice</b> / <b>alice1234</b>, account{' '}
            210987654321) shows that hosted zones are isolated per user.
          </Alert>
        </Box>
        <Box margin={{ top: 'm' }} color="text-body-secondary" fontSize="body-s" textAlign="center">
          This is a demo clone of the Route 53 console. Sign-in is mocked; no AWS account is used.{' '}
          <Link fontSize="body-s" href="https://docs.aws.amazon.com/route53/" external>
            About Route 53
          </Link>
        </Box>
      </div>
    </div>
  );
}
