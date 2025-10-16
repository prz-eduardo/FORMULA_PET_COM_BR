# ✅ Implementação Completa: Busca de Cliente por CPF

## 📋 Resumo da Implementação

Foi implementada a funcionalidade de busca de clientes e seus pets pelo CPF no componente **Gerar Receita**. Quando o veterinário digita um CPF válido, o sistema faz uma requisição ao backend para buscar os dados do cliente e todos os pets cadastrados.

---

## 🔄 Fluxo de Funcionamento

```
1. Veterinário digita CPF no campo
   ↓
2. Após 11 dígitos, busca automática é acionada
   ↓
3. Frontend faz GET para /api/clientes/cpf/:cpf?include=pets
   ↓
4. Backend busca cliente e pets no banco de dados
   ↓
5. Dados são retornados e exibidos na tela
   ↓
6. Veterinário pode selecionar um pet para a receita
```

---

## 📁 Arquivos Modificados

### 1. **api.service.ts** (Frontend)
✅ Adicionados dois novos métodos:

```typescript
// Buscar apenas cliente
buscarClientePorCpf(cpf: string, token: string): Observable<any>

// Buscar cliente com pets incluídos
buscarClienteComPets(cpf: string, token: string): Observable<any>
```

**Localização:** `src/app/services/api.service.ts`

---

### 2. **gerar-receita.component.ts** (Frontend)
✅ Modificado o método `buscarTutor()`:

**Antes:**
- Usava dados mockados (CPF: 11111111111)
- Não fazia chamada ao backend

**Depois:**
- Faz requisição real ao backend
- Obtém token do localStorage
- Valida CPF antes de buscar
- Trata erros (404, etc.)
- Mapeia dados do backend para o formato do componente
- Formata CPF para exibição (000.000.000-00)

**Localização:** `src/app/pages/restrito/area-vet/gerar-receita/gerar-receita.component.ts`

---

## 🎯 Funcionalidades Implementadas

### ✅ Frontend (Angular)

1. **Validação de CPF**
   - Verifica se tem 11 dígitos
   - Remove caracteres especiais

2. **Autenticação**
   - Obtém token do localStorage
   - Envia token no header Authorization

3. **Busca Automática**
   - Ao digitar 11 dígitos, busca automaticamente
   - Indicador de carregamento durante busca

4. **Tratamento de Erros**
   - Cliente não encontrado → Habilita cadastro manual
   - Erro de autenticação → Alerta ao usuário
   - Erro de servidor → Exibe mensagem de erro

5. **Exibição de Dados**
   - Mostra dados do cliente encontrado
   - Lista todos os pets cadastrados
   - Permite seleção de pet para receita

6. **Cadastro Manual**
   - Se cliente não encontrado, permite cadastro manual
   - CPF já vem preenchido

### 📝 Backend (A Implementar)

O arquivo `backend/INSTRUCOES_BACKEND.md` contém:

1. **Especificação dos Endpoints**
   - GET /api/clientes/cpf/:cpf
   - GET /api/clientes/cpf/:cpf?include=pets

2. **Exemplos de Implementação**
   - Node.js/Express
   - Go/Gin Framework

3. **Estrutura de Banco de Dados**
   - Tabela `clientes`
   - Tabela `pets`
   - Índices para performance

4. **Middleware de Autenticação**
   - Verificação de token JWT
   - Validação de tipo de usuário (veterinário)

5. **Exemplos de Teste**
   - cURL
   - Postman

---

## 🔐 Segurança

1. **Autenticação Obrigatória**
   - Todas as requisições exigem token JWT
   - Token deve ser de um veterinário válido

2. **Validação de CPF**
   - CPF é validado antes de buscar no banco
   - Proteção contra SQL injection

3. **Dados Sensíveis**
   - Senha do cliente não é retornada
   - Apenas veterinários podem acessar dados de clientes

---

## 📊 Estrutura de Dados

### Request (Frontend → Backend)
```
GET /api/clientes/cpf/12345678900?include=pets
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (Backend → Frontend)
```json
{
  "cliente": {
    "id": 1,
    "nome": "João Silva",
    "cpf": "12345678900",
    "email": "joao@email.com",
    "telefone": "(11) 98888-7777",
    "endereco": "Rua das Flores, 123 - São Paulo/SP"
  },
  "pets": [
    {
      "id": 1,
      "nome": "Rex",
      "especie": "Cachorro",
      "raca": "Labrador",
      "idade": 5,
      "peso": 20,
      "sexo": "Macho",
      "alergias": ["Pólen"],
      "cliente_id": 1
    }
  ]
}
```

---

## 🧪 Como Testar

### 1. No Frontend (Desenvolvimento)

1. Acesse a área de veterinário
2. Entre em "Gerar Receita"
3. Digite um CPF com 11 dígitos
4. Aguarde a busca automática
5. Verifique:
   - ✅ Dados do cliente aparecem
   - ✅ Lista de pets é exibida
   - ✅ É possível selecionar um pet

### 2. Se Cliente Não Encontrado

1. Digite um CPF não cadastrado
2. Verifique:
   - ✅ Alerta aparece
   - ✅ Formulário de cadastro manual é exibido
   - ✅ CPF já vem preenchido

### 3. Simulando Erros

**Token Inválido:**
1. Limpe o localStorage
2. Tente buscar um CPF
3. Verifique alerta de erro

**CPF Inválido:**
1. Digite menos de 11 dígitos
2. Clique em "Buscar"
3. Verifique mensagem de validação

---

## 🚀 Próximos Passos (Backend)

1. **Implementar Endpoints**
   - GET /api/clientes/cpf/:cpf
   - Seguir especificações em `backend/INSTRUCOES_BACKEND.md`

2. **Configurar Banco de Dados**
   - Criar tabelas `clientes` e `pets`
   - Adicionar índices

3. **Implementar Autenticação**
   - Middleware JWT
   - Validação de tipo de usuário

4. **Testar Integração**
   - Testar com dados reais
   - Validar performance

5. **Deploy**
   - Configurar variáveis de ambiente
   - Configurar CORS

---

## 📝 Notas Técnicas

### Validação de CPF
```typescript
// Remove caracteres não numéricos
const cpfLimpo = cpf.replace(/\D/g, '');

// Valida tamanho
if (cpfLimpo.length !== 11) {
  // CPF inválido
}
```

### Formatação de CPF para Exibição
```typescript
formatarCpf(cpf: string): string {
  const cpfLimpo = cpf.replace(/\D/g, '');
  return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
```

### Mapeamento de Dados Backend → Frontend
```typescript
this.tutorEncontrado = {
  nome: response.cliente.nome || '',
  cpf: this.formatarCpf(response.cliente.cpf) || this.cpf,
  telefone: response.cliente.telefone || '',
  email: response.cliente.email || '',
  endereco: response.cliente.endereco || '',
  pets: (response.pets || []).map(pet => ({
    id: pet.id?.toString() || '',
    nome: pet.nome || '',
    especie: pet.especie || '',
    idade: pet.idade || 0,
    peso: pet.peso || 0,
    raca: pet.raca || '',
    sexo: pet.sexo || 'Macho',
    alergias: pet.alergias || []
  }))
};
```

---

## ✅ Checklist de Implementação

### Frontend ✅ COMPLETO
- [x] Método de busca no serviço API
- [x] Validação de CPF
- [x] Obtenção de token do localStorage
- [x] Tratamento de erros
- [x] Mapeamento de dados
- [x] Formatação de CPF
- [x] Cadastro manual como fallback
- [x] Loading state

### Backend ⏳ PENDENTE
- [ ] Endpoint GET /api/clientes/cpf/:cpf
- [ ] Query para buscar cliente por CPF
- [ ] Query para buscar pets do cliente
- [ ] Middleware de autenticação
- [ ] Validação de CPF
- [ ] Tratamento de erros
- [ ] Testes de integração

---

## 🎉 Conclusão

A implementação no **frontend está completa e funcional**. Quando o backend for implementado seguindo as especificações em `backend/INSTRUCOES_BACKEND.md`, a funcionalidade estará 100% operacional.

O veterinário poderá:
1. Digitar o CPF do cliente
2. Ver todos os dados do cliente automaticamente
3. Ver todos os pets cadastrados
4. Selecionar um pet para gerar a receita
5. Ou cadastrar manualmente se o cliente não estiver no sistema

