export interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    customizations: {
      [key: string]: string[];  // Customizações podem ser de qualquer tipo, como tamanho, fragrância, etc.
    };
}

export {};
  