# Estrutura de SEO Técnico - Conectize

## Arquitetura de URLs

A estrutura segue uma hierarquia de 4 níveis:

```
/servicos                                    → Lista todos os serviços
/servicos/[servico]                          → Lista marcas para um serviço
/servicos/[servico]/[marca]                  → Lista tipos de equipamento para uma marca
/servicos/[servico]/[marca]/[tipo]           → Lista modelos para um tipo de equipamento
/servicos/[servico]/[marca]/[tipo]/[modelo]  → Página específica do modelo
```

### Exemplos de URLs:

- `/servicos/troca-de-tela`
- `/servicos/troca-de-tela/apple`
- `/servicos/troca-de-tela/apple/iphone`
- `/servicos/troca-de-tela/apple/iphone/iphone-15-pro-max`
- `/servicos/troca-de-bateria/apple/macbook/macbook-pro`
- `/servicos/correcoes-de-software/samsung/smartphone/galaxy-s24-ultra`

## Estrutura de Dados

### Serviços (`src/lib/data/services.ts`)

Cada serviço contém:
- `slug`: URL amigável (ex: `troca-de-tela`)
- `name`: Nome do serviço
- `description`: Descrição completa para SEO
- `shortDescription`: Descrição curta para cards
- `keywords`: Palavras-chave relacionadas
- `brands`: Array de slugs de marcas atendidas

### Marcas

Cada marca contém:
- `slug`: URL amigável (ex: `apple`)
- `name`: Nome da marca
- `displayName`: Nome para exibição
- `deviceTypes`: Objeto com tipos de equipamento (iPhone, iPad, MacBook, etc.)

### Tipos de Equipamento

Cada tipo de equipamento contém:
- `slug`: URL amigável (ex: `iphone`, `macbook`, `watch`)
- `name`: Nome do tipo
- `displayName`: Nome para exibição
- `models`: Array de slugs de modelos

### Modelos

Cada modelo é referenciado por slug dentro do tipo de equipamento.

## Como Adicionar Novos Itens

### Adicionar um Novo Serviço

1. Edite `src/lib/data/services.ts`
2. Adicione um objeto no array `services`:

```typescript
{
  slug: 'novo-servico',
  name: 'Novo Serviço',
  description: 'Descrição completa...',
  shortDescription: 'Descrição curta',
  keywords: ['palavra1', 'palavra2'],
  brands: ['apple', 'samsung'] // marcas que oferecem este serviço
}
```

### Adicionar uma Nova Marca

1. Edite `src/lib/data/services.ts`
2. Adicione no objeto `brands`:

```typescript
novaMarca: {
  slug: 'nova-marca',
  name: 'Nova Marca',
  displayName: 'Nova Marca',
  deviceTypes: {
    smartphone: {
      slug: 'smartphone',
      name: 'Smartphone',
      displayName: 'Smartphone',
      models: ['modelo-1', 'modelo-2']
    }
  }
}
```

3. Adicione o slug da marca nos serviços que a atendem

### Adicionar um Novo Tipo de Equipamento

1. Edite `src/lib/data/services.ts`
2. Adicione no objeto `deviceTypes` da marca:

```typescript
deviceTypes: {
  // tipos existentes...
  novoTipo: {
    slug: 'novo-tipo',
    name: 'Novo Tipo',
    displayName: 'Novo Tipo',
    models: ['modelo-1', 'modelo-2']
  }
}
```

### Adicionar um Novo Modelo

1. Edite `src/lib/data/services.ts`
2. Adicione o slug do modelo no array `models` do tipo de equipamento:

```typescript
models: [
  'modelo-existente',
  'novo-modelo' // novo modelo aqui
]
```

## Serviços Disponíveis

- Troca de Tela
- Troca de Bateria
- Reparo de Placa
- Troca de Conector de Carregamento
- Troca de Câmera
- **Correções de Software** (remoção de vírus, reset de fábrica, atualização de sistema, recuperação de dados)
- Reparo de Áudio
- Reparo de Danos por Água

## Tipos de Equipamento por Marca

### Apple
- iPhone
- iPad
- MacBook
- Apple Watch

### Samsung
- Smartphone
- Tablet

### Outras Marcas
- Smartphone (Xiaomi, Motorola, LG)

## Otimizações SEO Implementadas

### 1. Metadata Dinâmica
- Títulos únicos por página
- Descriptions otimizadas
- Keywords específicas
- URLs canônicas

### 2. Structured Data (Schema.org)
- Tipo `Service` para cada página
- Informações de negócio local
- Hierarquia clara

### 3. Breadcrumbs
- Navegação hierárquica
- Melhora UX e SEO
- Links internos otimizados

### 4. Headings Semânticos
- H1 único por página
- H2 para seções principais
- H3 para subseções

### 5. Conteúdo Otimizado
- Texto objetivo e informativo
- Long-tail keywords
- Preparado para LLMs e busca

### 6. Sitemap Dinâmico
- Geração automática
- Inclui todas as páginas
- Prioridades configuradas

### 7. Robots.txt
- Configuração otimizada
- Referência ao sitemap

## Componentes Reutilizáveis

### `Breadcrumbs`
Componente de navegação hierárquica

### `ServiceCard`
Card para exibir serviços na listagem

### `BrandCard`
Card para exibir marcas

### `DeviceTypeCard`
Card para exibir tipos de equipamento

### `ModelCard`
Card para exibir modelos

## Geração Estática

Todas as páginas são geradas estaticamente em build time usando `generateStaticParams()`, garantindo:
- Performance otimizada
- Melhor indexação
- SEO aprimorado

## Próximos Passos

1. Adicionar mais serviços conforme necessário
2. Expandir lista de marcas e tipos de equipamento
3. Adicionar conteúdo específico por modelo
4. Implementar reviews/testimonials por serviço
5. Adicionar FAQ por serviço
6. Criar páginas de comparação
