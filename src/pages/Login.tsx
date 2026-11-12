import {useState} from 'react';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Center} from '@astryxdesign/core/Center';
import {Icon} from '@astryxdesign/core/Icon';
import {NavIcon} from '@astryxdesign/core/NavIcon';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Heading, Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SparklesIcon} from '@heroicons/react/24/outline';
import {useAuth} from '../lib/auth';

export default function Login() {
  const {signIn} = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    if (!password || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      await signIn(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Center height="100%">
      <Card width={380} padding={6}>
        <VStack gap={5}>
          <HStack gap={3} vAlign="center">
            <NavIcon icon={<Icon icon={SparklesIcon} size="sm" />} />
            <VStack gap={0.5}>
              <Heading level={3}>Luma Catering</Heading>
              <Text type="supporting" color="secondary">
                Вход для сотрудников
              </Text>
            </VStack>
          </HStack>

          {error ? <Banner status="error" title={error} /> : null}

          <TextInput
            label="Пароль"
            type="password"
            hasAutoFocus
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            onEnter={submit}
          />
          <Button
            label="Войти"
            variant="primary"
            width="100%"
            isLoading={isBusy}
            isDisabled={!password}
            onClick={submit}
          />
        </VStack>
      </Card>
    </Center>
  );
}
