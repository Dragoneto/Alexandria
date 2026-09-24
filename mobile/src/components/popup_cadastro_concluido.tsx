import { ConfirmDialog } from '@/components/confirm-dialog';
import { Accent } from '@/constants/design-system';

type PopupCadastroConcluidoProps = {
  visible: boolean;
  /** Nome devolvido pelo backend, usado para personalizar o título. */
  nome?: string;
  onConfirm: () => void;
};

/** Confirmação exibida logo após o cadastro dar certo. */
export function PopupCadastroConcluido({ visible, nome, onConfirm }: PopupCadastroConcluidoProps) {
  const titulo = nome ? `Boas-vindas, ${nome}!` : 'Conta criada!';

  return (
    <ConfirmDialog
      options={
        visible
          ? {
              title: titulo,
              text: 'Sua conta foi criada com sucesso. Entre com seu e-mail e senha para começar a montar sua estante.',
              confirmLabel: 'Fazer login',
              // Uma ação só: aqui não existe "cancelar"
              cancelLabel: null,
              badge: {
                icon: { ios: 'checkmark', android: 'check', web: 'check' },
                color: Accent.laurel,
              },
            }
          : null
      }
      onConfirm={onConfirm}
      // Botão voltar e toque fora fazem o mesmo que o botão principal
      onCancel={onConfirm}
    />
  );
}
