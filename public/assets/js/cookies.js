/* Consentimento de cookies — Silktide Consent Manager (open source, servido localmente).
   Google Consent Mode v2: os valores por defeito (todos negados) estão em index.html, antes deste ficheiro;
   as categorias abaixo atualizam o Google via a opção `gtag`. Neste momento o site só usa armazenamento
   estritamente necessário; para ligar GA4/Ads basta carregar as tags depois deste gestor. */
window.silktideConsentManager.init({
  prompt: { position: 'bottomRight' },
  icon: { position: 'bottomLeft' },
  backdrop: { show: false },
  consentTypes: [
    {
      id: 'essential',
      label: 'Essenciais',
      description: '<p>Necessários para o site funcionar, por exemplo guardar o progresso de uma marcação. Não podem ser desativados.</p>',
      required: true
    },
    {
      id: 'analytics',
      label: 'Estatísticas',
      description: '<p>Ajudam-nos a perceber, de forma agregada, como o site é utilizado. Só são ativados com o seu consentimento.</p>',
      defaultValue: false,
      gtag: 'analytics_storage'
    },
    {
      id: 'marketing',
      label: 'Marketing',
      description: '<p>Permitem medir campanhas e apresentar publicidade relevante. Só são ativados com o seu consentimento.</p>',
      defaultValue: false,
      gtag: ['ad_storage', 'ad_user_data', 'ad_personalization']
    }
  ],
  text: {
    prompt: {
      description: '<p>Utilizamos armazenamento essencial para o site funcionar e, com a sua autorização, estatísticas e marketing.</p>',
      acceptAllButtonText: 'Aceitar todos',
      acceptAllButtonAccessibleLabel: 'Aceitar todos os cookies',
      rejectNonEssentialButtonText: 'Apenas essenciais',
      rejectNonEssentialButtonAccessibleLabel: 'Rejeitar os cookies não essenciais',
      preferencesButtonText: 'Preferências',
      preferencesButtonAccessibleLabel: 'Gerir preferências de cookies'
    },
    preferences: {
      title: 'Preferências de cookies',
      description: '<p>Escolha que tipos de cookies pretende permitir. Pode alterar esta escolha em qualquer altura.</p>',
      saveButtonText: 'Guardar e fechar',
      saveButtonAccessibleLabel: 'Guardar as preferências de cookies',
      creditLinkText: 'Gestor de consentimento gratuito',
      creditLinkAccessibleLabel: 'Visitar o Silktide Consent Manager'
    }
  }
});
