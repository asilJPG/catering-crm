import {useCallback, useEffect, useState} from 'react';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Icon} from '@astryxdesign/core/Icon';
import {HStack} from '@astryxdesign/core/Layout';
import {MoreMenu} from '@astryxdesign/core/MoreMenu';
import {Selector} from '@astryxdesign/core/Selector';
import {Switch} from '@astryxdesign/core/Switch';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {PlusIcon} from '@heroicons/react/24/outline';
import {FormDialog} from '../components/FormDialog';
import {PageFrame} from '../components/PageFrame';
import {useCurrentUser} from '../lib/auth';
import {backend, validatePassword} from '../lib/backend';
import {ASSIGNABLE_ROLES, ROLE_LABEL} from '../lib/permissions';
import type {AppUser, Role} from '../lib/types';

type Draft = {
  id: string | null;
  name: string;
  role: Role;
  active: boolean;
  password: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  role: 'manager',
  active: true,
  password: '',
});

function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return [...bytes].map(n => alphabet[n % alphabet.length]).join('');
}

export default function Users() {
  const {user: me} = useCurrentUser();
  const [people, setPeople] = useState<AppUser[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toRemove, setToRemove] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const reload = useCallback(
    () => backend.listPeople().then(setPeople).catch(e => setError(e.message)),
    [],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const patch = (changes: Partial<Draft>) =>
    setDraft(prev => (prev ? {...prev, ...changes} : prev));

  const isNew = draft?.id === null;
  const canSubmit =
    !!draft &&
    draft.name.trim().length > 0 &&
    (isNew ? draft.password.length > 0 : true);

  const submit = async () => {
    if (!draft || isBusy) return;
    setFormError(null);
    const passwordProblem =
      draft.password || isNew ? validatePassword(draft.password) : null;
    if (passwordProblem) {
      setFormError(passwordProblem);
      return;
    }
    setIsBusy(true);
    try {
      if (isNew) {
        await backend.createUser({
          name: draft.name.trim(),
          role: draft.role,
          password: draft.password,
        });
      } else {
        await backend.updateUser(draft.id!, {
          name: draft.name.trim(),
          role: draft.role,
          active: draft.active,
          password: draft.password || undefined,
        });
      }
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setIsBusy(false);
    }
  };

  const remove = async () => {
    if (!toRemove) return;
    try {
      await backend.deleteUser(toRemove.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
    }
    setToRemove(null);
  };

  const columns: TableColumn<AppUser>[] = [
    {
      key: 'name',
      header: 'Сотрудник',
      width: proportional(2, {minWidth: 180}),
      renderCell: person => (
        <Text type="body" weight="medium">
          {person.name}
          {person.id === me.id ? ' (вы)' : ''}
        </Text>
      ),
    },
    {
      key: 'role',
      header: 'Роль',
      width: pixel(150),
      renderCell: person => (
        <Badge
          variant={person.role === 'admin' ? 'purple' : person.role === 'director' ? 'blue' : 'neutral'}
          label={ROLE_LABEL[person.role]}
        />
      ),
    },
    {
      key: 'active',
      header: 'Доступ',
      width: pixel(130),
      renderCell: person => (
        <Badge
          variant={person.active ? 'success' : 'error'}
          label={person.active ? 'Активен' : 'Отключён'}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: pixel(70),
      align: 'end',
      renderCell: person =>
        person.id === me.id ? null : (
          <MoreMenu
            size="sm"
            label="Действия с сотрудником"
            items={[
              {
                label: 'Изменить или сменить пароль',
                onClick: () => {
                  setFormError(null);
                  setDraft({...person, password: ''});
                },
              },
              {label: 'Удалить', onClick: () => setToRemove(person)},
            ]}
          />
        ),
    },
  ];

  return (
    <PageFrame
      title="Сотрудники"
      subtitle="Создавайте менеджеров и директоров и выдавайте каждому свой пароль для входа"
      actions={
        <Button
          label="Новый сотрудник"
          variant="primary"
          icon={<Icon icon={PlusIcon} size="sm" />}
          onClick={() => {
            setFormError(null);
            setDraft({...emptyDraft(), password: generatePassword()});
          }}
        />
      }>
      {error ? <Banner status="error" title={error} /> : null}
      <Card padding={0}>
        {people.length > 0 ? (
          <Table data={people} columns={columns} idKey="id" hasHover />
        ) : (
          <EmptyState title="Сотрудников нет" description="Добавьте первого сотрудника." />
        )}
      </Card>

      <FormDialog
        isOpen={draft !== null}
        title={isNew ? 'Новый сотрудник' : 'Сотрудник'}
        subtitle={
          isNew
            ? 'Передайте пароль сотруднику — по нему он входит в систему'
            : 'Оставьте пароль пустым, чтобы не менять его'
        }
        submitLabel={isNew ? 'Создать' : 'Сохранить'}
        isSubmitDisabled={!canSubmit || isBusy}
        onClose={() => setDraft(null)}
        onSubmit={submit}>
        {draft ? (
          <>
            {formError ? <Banner status="error" title={formError} /> : null}
            <TextInput
              label="Имя"
              isRequired
              value={draft.name}
              onChange={name => patch({name})}
            />
            <Selector
              label="Роль"
              options={ASSIGNABLE_ROLES.map(value => ({value, label: ROLE_LABEL[value]}))}
              value={draft.role}
              onChange={role => patch({role: role as Role})}
            />
            <HStack gap={2} vAlign="end">
              <TextInput
                label={isNew ? 'Пароль' : 'Новый пароль'}
                description="Не короче 8 символов, у каждого сотрудника свой"
                width="100%"
                isRequired={isNew}
                autoComplete="new-password"
                value={draft.password}
                onChange={password => patch({password})}
              />
              <Button
                label="Сгенерировать"
                variant="secondary"
                onClick={() => patch({password: generatePassword()})}
              />
            </HStack>
            {!isNew ? (
              <Switch
                label="Доступ разрешён"
                value={draft.active}
                onChange={active => patch({active})}
              />
            ) : null}
          </>
        ) : null}
      </FormDialog>

      <AlertDialog
        isOpen={toRemove !== null}
        onOpenChange={open => {
          if (!open) setToRemove(null);
        }}
        title="Удалить сотрудника?"
        description={`«${toRemove?.name ?? ''}» потеряет доступ. Его мероприятия останутся, но будут видны только директору и администратору.`}
        cancelLabel="Отмена"
        actionLabel="Удалить"
        actionVariant="destructive"
        onAction={remove}
      />
    </PageFrame>
  );
}
