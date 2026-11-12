import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Icon} from '@astryxdesign/core/Icon';
import {IconButton} from '@astryxdesign/core/IconButton';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import type {TableColumn} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {PencilSquareIcon, PlusIcon} from '@heroicons/react/24/outline';
import {FormDialog} from '../components/FormDialog';
import {PageFrame} from '../components/PageFrame';
import {eventTotals, money, newId} from '../lib/format';
import {useCurrentUser} from '../lib/auth';
import {useStore} from '../lib/store';
import type {Client} from '../lib/types';

const emptyClient = (): Client => ({
  id: '',
  name: '',
  company: '',
  phone: '',
  email: '',
});

export function ClientFields({
  value,
  onChange,
}: {
  value: Client;
  onChange: (client: Client) => void;
}) {
  return (
    <>
      <TextInput
        label="Имя"
        isRequired
        value={value.name}
        onChange={name => onChange({...value, name})}
      />
      <TextInput
        label="Компания"
        isOptional
        value={value.company}
        onChange={company => onChange({...value, company})}
      />
      <TextInput
        label="Телефон"
        type="tel"
        isRequired
        value={value.phone}
        onChange={phone => onChange({...value, phone})}
      />
      <TextInput
        label="Email"
        type="email"
        isOptional
        value={value.email}
        onChange={email => onChange({...value, email})}
      />
    </>
  );
}

export default function Clients() {
  const {clients, events, catalog, saveClient} = useStore();
  const {can} = useCurrentUser();
  const [draft, setDraft] = useState<Client | null>(null);

  const statsFor = (clientId: string) => {
    const own = events.filter(
      event => event.clientId === clientId && event.status !== 'cancelled',
    );
    return {
      count: own.length,
      total: own.reduce((sum, event) => sum + eventTotals(event, catalog).total, 0),
    };
  };

  const columns: TableColumn<Client>[] = [
    {
      key: 'name',
      header: 'Клиент',
      width: proportional(2, {minWidth: 180}),
      renderCell: client => (
        <Text type="body" weight="medium">
          {client.name}
        </Text>
      ),
    },
    {
      key: 'company',
      header: 'Компания',
      width: proportional(2, {minWidth: 160}),
      renderCell: client => client.company || '—',
    },
    {key: 'phone', header: 'Телефон', width: pixel(190)},
    {
      key: 'email',
      header: 'Email',
      width: proportional(2, {minWidth: 180}),
      renderCell: client => client.email || '—',
    },
    {
      key: 'events',
      header: 'Мероприятий',
      width: pixel(120),
      align: 'end',
      renderCell: client => statsFor(client.id).count,
    },
    {
      key: 'total',
      header: 'На сумму',
      width: pixel(140),
      align: 'end',
      renderCell: client => money(statsFor(client.id).total),
    },
    ...(can.editClients
      ? [{
      key: 'actions',
      header: '',
      width: pixel(60),
      align: 'end',
      renderCell: client => (
        <IconButton
          label="Изменить клиента"
          variant="ghost"
          size="sm"
          icon={<Icon icon={PencilSquareIcon} size="sm" />}
          onClick={() => setDraft(client)}
        />
      ),
    } satisfies TableColumn<Client>]
      : []),
  ];

  const submit = () => {
    if (!draft) return;
    saveClient({...draft, id: draft.id || newId('c')});
    setDraft(null);
  };

  return (
    <PageFrame
      title="Клиенты"
      subtitle="База заказчиков и история их мероприятий"
      actions={
        <Button
          label="Новый клиент"
          variant="primary"
          icon={<Icon icon={PlusIcon} size="sm" />}
          onClick={() => setDraft(emptyClient())}
        />
      }>
      <Card padding={0}>
        {clients.length > 0 ? (
          <Table data={clients} columns={columns} idKey="id" hasHover />
        ) : (
          <EmptyState
            title="Клиентов пока нет"
            description="Добавьте первого клиента или создайте его из заявки."
          />
        )}
      </Card>

      <FormDialog
        isOpen={draft !== null}
        title={draft?.id ? 'Клиент' : 'Новый клиент'}
        isSubmitDisabled={!draft || !draft.name.trim() || !draft.phone.trim()}
        onClose={() => setDraft(null)}
        onSubmit={submit}>
        {draft ? <ClientFields value={draft} onChange={setDraft} /> : null}
      </FormDialog>
    </PageFrame>
  );
}
