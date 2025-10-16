# Instruções para Implementar Backend - Busca de Cliente por CPF

## Endpoints Necessários

### 1. Buscar Cliente por CPF (sem pets)
```
GET /api/clientes/cpf/:cpf
```

**Headers:**
```
Authorization: Bearer <token_veterinario>
```

**Response (200 OK):**
```json
{
  "cliente": {
    "id": 1,
    "nome": "João Silva",
    "cpf": "12345678900",
    "email": "joao@email.com",
    "telefone": "(11) 98888-7777",
    "endereco": "Rua das Flores, 123 - São Paulo/SP",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Cliente não encontrado",
  "message": "Nenhum cliente cadastrado com este CPF"
}
```

---

### 2. Buscar Cliente com Pets Incluídos
```
GET /api/clientes/cpf/:cpf?include=pets
```

**Headers:**
```
Authorization: Bearer <token_veterinario>
```

**Response (200 OK):**
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
    },
    {
      "id": 2,
      "nome": "Mimi",
      "especie": "Gato",
      "raca": "Persa",
      "idade": 3,
      "peso": 4,
      "sexo": "Fêmea",
      "alergias": [],
      "cliente_id": 1
    }
  ]
}
```

---

## Exemplo de Implementação em Node.js/Express

```javascript
// routes/clientes.js
const express = require('express');
const router = express.Router();
const { authenticateVet } = require('../middleware/auth');

// GET /api/clientes/cpf/:cpf
router.get('/cpf/:cpf', authenticateVet, async (req, res) => {
  try {
    const { cpf } = req.params;
    const includePets = req.query.include === 'pets';
    
    // Limpar CPF (remover pontos e traços)
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    // Validar CPF
    if (cpfLimpo.length !== 11) {
      return res.status(400).json({ 
        error: 'CPF inválido',
        message: 'O CPF deve conter 11 dígitos' 
      });
    }
    
    // Buscar cliente no banco de dados
    const cliente = await db.query(
      'SELECT * FROM clientes WHERE cpf = ?',
      [cpfLimpo]
    );
    
    if (!cliente || cliente.length === 0) {
      return res.status(404).json({ 
        error: 'Cliente não encontrado',
        message: 'Nenhum cliente cadastrado com este CPF' 
      });
    }
    
    const clienteData = cliente[0];
    
    // Se incluir pets, buscar também
    if (includePets) {
      const pets = await db.query(
        'SELECT * FROM pets WHERE cliente_id = ?',
        [clienteData.id]
      );
      
      return res.json({
        cliente: clienteData,
        pets: pets || []
      });
    }
    
    // Retornar apenas cliente
    return res.json({ cliente: clienteData });
    
  } catch (error) {
    console.error('Erro ao buscar cliente:', error);
    return res.status(500).json({ 
      error: 'Erro interno',
      message: 'Erro ao buscar cliente no banco de dados' 
    });
  }
});

module.exports = router;
```

---

## Exemplo de Implementação em Go (Gin Framework)

```go
package main

import (
	"database/sql"
	"net/http"
	"regexp"
	"github.com/gin-gonic/gin"
)

type Cliente struct {
	ID        int    `json:"id"`
	Nome      string `json:"nome"`
	CPF       string `json:"cpf"`
	Email     string `json:"email"`
	Telefone  string `json:"telefone"`
	Endereco  string `json:"endereco"`
	CreatedAt string `json:"created_at"`
}

type Pet struct {
	ID        int      `json:"id"`
	Nome      string   `json:"nome"`
	Especie   string   `json:"especie"`
	Raca      string   `json:"raca"`
	Idade     int      `json:"idade"`
	Peso      float64  `json:"peso"`
	Sexo      string   `json:"sexo"`
	Alergias  []string `json:"alergias"`
	ClienteID int      `json:"cliente_id"`
}

// GET /api/clientes/cpf/:cpf
func buscarClientePorCPF(c *gin.Context) {
	cpf := c.Param("cpf")
	includePets := c.Query("include") == "pets"
	
	// Limpar CPF (remover caracteres não numéricos)
	re := regexp.MustCompile(`\D`)
	cpfLimpo := re.ReplaceAllString(cpf, "")
	
	// Validar CPF
	if len(cpfLimpo) != 11 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "CPF inválido",
			"message": "O CPF deve conter 11 dígitos",
		})
		return
	}
	
	// Buscar cliente no banco
	var cliente Cliente
	err := db.QueryRow(`
		SELECT id, nome, cpf, email, telefone, endereco, created_at 
		FROM clientes 
		WHERE cpf = ?
	`, cpfLimpo).Scan(
		&cliente.ID,
		&cliente.Nome,
		&cliente.CPF,
		&cliente.Email,
		&cliente.Telefone,
		&cliente.Endereco,
		&cliente.CreatedAt,
	)
	
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "Cliente não encontrado",
			"message": "Nenhum cliente cadastrado com este CPF",
		})
		return
	}
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Erro interno",
			"message": "Erro ao buscar cliente no banco de dados",
		})
		return
	}
	
	// Se incluir pets
	if includePets {
		rows, err := db.Query(`
			SELECT id, nome, especie, raca, idade, peso, sexo, alergias, cliente_id
			FROM pets
			WHERE cliente_id = ?
		`, cliente.ID)
		
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Erro ao buscar pets",
			})
			return
		}
		defer rows.Close()
		
		var pets []Pet
		for rows.Next() {
			var pet Pet
			var alergiasStr string
			err := rows.Scan(
				&pet.ID,
				&pet.Nome,
				&pet.Especie,
				&pet.Raca,
				&pet.Idade,
				&pet.Peso,
				&pet.Sexo,
				&alergiasStr,
				&pet.ClienteID,
			)
			if err == nil {
				// Parse alergias (assumindo que é JSON ou CSV)
				// pet.Alergias = parseAlergias(alergiasStr)
				pets = append(pets, pet)
			}
		}
		
		c.JSON(http.StatusOK, gin.H{
			"cliente": cliente,
			"pets":    pets,
		})
		return
	}
	
	// Retornar apenas cliente
	c.JSON(http.StatusOK, gin.H{
		"cliente": cliente,
	})
}

func main() {
	router := gin.Default()
	
	// Middleware de autenticação
	api := router.Group("/api")
	api.Use(AuthMiddleware())
	{
		api.GET("/clientes/cpf/:cpf", buscarClientePorCPF)
	}
	
	router.Run(":8080")
}
```

---

## Estrutura de Banco de Dados Necessária

### Tabela: clientes
```sql
CREATE TABLE clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(11) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  endereco TEXT,
  senha_hash VARCHAR(255),
  tipo VARCHAR(50) DEFAULT 'cliente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cpf (cpf)
);
```

### Tabela: pets
```sql
CREATE TABLE pets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  especie VARCHAR(50) NOT NULL,
  raca VARCHAR(100),
  idade INT,
  peso DECIMAL(10, 2),
  sexo ENUM('Macho', 'Fêmea') NOT NULL,
  alergias JSON,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  INDEX idx_cliente_id (cliente_id)
);
```

---

## Middleware de Autenticação (Exemplo)

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticateVet(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Não autorizado',
      message: 'Token de autenticação não fornecido' 
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer '
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar se é veterinário
    if (decoded.tipo !== 'veterinario') {
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: 'Apenas veterinários podem acessar este recurso' 
      });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      error: 'Token inválido',
      message: 'Token de autenticação inválido ou expirado' 
    });
  }
}

module.exports = { authenticateVet };
```

---

## Testando os Endpoints

### 1. Usando cURL

```bash
# Buscar cliente sem pets
curl -X GET "http://localhost:8080/api/clientes/cpf/12345678900" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"

# Buscar cliente com pets
curl -X GET "http://localhost:8080/api/clientes/cpf/12345678900?include=pets" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### 2. Usando Postman

1. Criar nova requisição GET
2. URL: `http://localhost:8080/api/clientes/cpf/12345678900?include=pets`
3. Headers:
   - Key: `Authorization`
   - Value: `Bearer SEU_TOKEN_AQUI`
4. Enviar requisição

---

## Notas Importantes

1. **Segurança**: Sempre validar que o token é de um veterinário antes de permitir acesso aos dados dos clientes
2. **CPF**: Armazenar CPF sem formatação (apenas números) no banco de dados
3. **Alergias**: Pode ser armazenado como JSON ou array no banco
4. **Performance**: Criar índice na coluna CPF para buscas rápidas
5. **CORS**: Configurar CORS para permitir requisições do frontend Angular

