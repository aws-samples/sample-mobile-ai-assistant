import { Model, Usage, UsagePrice } from '../types/Chat.ts';

export const getUsagePrice = (usage: Usage): UsagePrice => {
  const usagePrice: UsagePrice = {
    modelName: usage.modelName,
    inputPrice: 0,
    outputPrice: 0,
    totalPrice: 0,
    smallImagePrice: 0,
    mediumImagePrice: 0,
    largeImagePrice: 0,
  };
  if (usage.imageCount || usage.smallImageCount || usage.largeImageCount) {
    if (usage.smallImageCount) {
      usagePrice.smallImagePrice = Number(
        (
          usage.smallImageCount *
          getImagePrice(usage.modelName as keyof ImageModelPrices, 'small')
        ).toFixed(2)
      );
    }

    if (usage.imageCount) {
      usagePrice.mediumImagePrice = Number(
        (
          usage.imageCount *
          getImagePrice(usage.modelName as keyof ImageModelPrices, 'medium')
        ).toFixed(2)
      );
    }

    if (usage.largeImageCount) {
      usagePrice.largeImagePrice = Number(
        (
          usage.largeImageCount *
          getImagePrice(usage.modelName as keyof ImageModelPrices, 'large')
        ).toFixed(2)
      );
    }
    usagePrice.totalPrice = Number(
      (
        usagePrice.smallImagePrice +
        usagePrice.mediumImagePrice +
        usagePrice.largeImagePrice
      ).toFixed(2)
    );
  } else {
    usagePrice.inputPrice = Number(
      (
        (usage.inputTokens *
          (ModelPrice.textModelPrices[usage.modelName]?.inputTokenPrice ??
            -1)) /
        1000
      ).toFixed(6)
    );

    usagePrice.outputPrice = Number(
      (
        (usage.outputTokens *
          (ModelPrice.textModelPrices[usage.modelName]?.outputTokenPrice ??
            -4)) /
        1000
      ).toFixed(6)
    );
    usagePrice.totalPrice = Number(
      (usagePrice.inputPrice + usagePrice.outputPrice).toFixed(2)
    );
  }
  return usagePrice;
};

function getImagePrice(
  modelName: keyof ImageModelPrices,
  size: 'small' | 'medium' | 'large'
): number {
  const model = ModelPrice.imageModelPrices[modelName];
  if (!model) {
    return 0;
  }
  return size in model ? model[size as keyof typeof model] : 0;
}

export const ModelPrice: ModelPriceType = {
  textModelPrices: {
    'Bedrock DeepSeek-R1': {
      inputTokenPrice: 0.00135,
      outputTokenPrice: 0.0054,
    },
    'DeepSeek-Chat': {
      inputTokenPrice: 0.00027,
      outputTokenPrice: 0.0011,
    },
    'DeepSeek-Reasoner': {
      inputTokenPrice: 0.00055,
      outputTokenPrice: 0.00219,
    },
    'GPT-5.4': {
      inputTokenPrice: 0.00125,
      outputTokenPrice: 0.0075,
    },
    'GPT-5.4 Pro': {
      inputTokenPrice: 0.015,
      outputTokenPrice: 0.09,
    },
    'GPT-5.4 mini': {
      inputTokenPrice: 0.00075,
      outputTokenPrice: 0.0045,
    },
    'GPT-5.4 nano': {
      inputTokenPrice: 0.0002,
      outputTokenPrice: 0.00125,
    },
    'GPT-5.3 Chat': {
      inputTokenPrice: 0.00175,
      outputTokenPrice: 0.014,
    },
    'GPT-5.2': {
      inputTokenPrice: 0.000875,
      outputTokenPrice: 0.007,
    },
    'GPT-5.2 Pro': {
      inputTokenPrice: 0.0105,
      outputTokenPrice: 0.084,
    },
    'GPT-5.1': {
      inputTokenPrice: 0.000625,
      outputTokenPrice: 0.005,
    },
    'GPT-5 Pro': {
      inputTokenPrice: 0.0075,
      outputTokenPrice: 0.06,
    },
    'GPT-4.1': {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.008,
    },
    'GPT-4.1 mini': {
      inputTokenPrice: 0.0004,
      outputTokenPrice: 0.0016,
    },
    'GPT-4.1 nano': {
      inputTokenPrice: 0.0001,
      outputTokenPrice: 0.0004,
    },
    'GPT-4o': {
      inputTokenPrice: 0.0025,
      outputTokenPrice: 0.01,
    },
    'GPT-4o mini': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0006,
    },
    'gpt-oss-20b': {
      inputTokenPrice: 0.00007,
      outputTokenPrice: 0.0003,
    },
    'gpt-oss-120b': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0006,
    },
    'Minimax M2': {
      inputTokenPrice: 0.0003,
      outputTokenPrice: 0.0012,
    },
    'Titan Text G1 - Lite': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0002,
    },
    'Titan Text G1 - Express': {
      inputTokenPrice: 0.0002,
      outputTokenPrice: 0.0006,
    },
    'Titan Text G1 - Premier': {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
    },
    'Nova Pro': {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.0032,
    },
    'Nova Lite': {
      inputTokenPrice: 0.00006,
      outputTokenPrice: 0.00024,
    },
    'Nova 2 Lite': {
      inputTokenPrice: 0.0003,
      outputTokenPrice: 0.0025,
    },
    'Nova Micro': {
      inputTokenPrice: 0.000035,
      outputTokenPrice: 0.00014,
    },
    'Claude 3.5 Sonnet v2': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude 3.5 Haiku': {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.004,
    },
    'Claude Instant': {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.0024,
    },
    Claude: {
      inputTokenPrice: 0.008,
      outputTokenPrice: 0.024,
    },
    'Claude 3 Sonnet': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude 3 Haiku': {
      inputTokenPrice: 0.00025,
      outputTokenPrice: 0.00125,
    },
    'Claude 3 Opus': {
      inputTokenPrice: 0.015,
      outputTokenPrice: 0.075,
    },
    'Claude 3.5 Sonnet': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude 3.7 Sonnet': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude Sonnet 4': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude Sonnet 4.5': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude Sonnet 4.6': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Claude Opus 4.5': {
      inputTokenPrice: 0.005,
      outputTokenPrice: 0.025,
    },
    'Claude Opus 4.6': {
      inputTokenPrice: 0.005,
      outputTokenPrice: 0.025,
    },
    'Claude Haiku 4.5': {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.005,
    },
    Command: {
      inputTokenPrice: 0.0015,
      outputTokenPrice: 0.002,
    },
    'Command R': {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
    },
    'Command R+': {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
    'Command Light': {
      inputTokenPrice: 0.0003,
      outputTokenPrice: 0.0006,
    },
    'Llama 3 8B Instruct': {
      inputTokenPrice: 0.0003,
      outputTokenPrice: 0.0006,
    },
    'Llama 3 70B Instruct': {
      inputTokenPrice: 0.00265,
      outputTokenPrice: 0.0035,
    },
    'Llama 3.1 8B Instruct': {
      inputTokenPrice: 0.00022,
      outputTokenPrice: 0.00022,
    },
    'Llama 3.1 70B Instruct': {
      inputTokenPrice: 0.00072,
      outputTokenPrice: 0.00072,
    },
    'Llama 3.1 405B Instruct': {
      inputTokenPrice: 0.0024,
      outputTokenPrice: 0.0024,
    },
    'Llama 3.2 1B Instruct': {
      inputTokenPrice: 0.0001,
      outputTokenPrice: 0.0001,
    },
    'Llama 3.2 3B Instruct': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.00015,
    },
    'Llama 3.2 11B Instruct': {
      inputTokenPrice: 0.00016,
      outputTokenPrice: 0.00016,
    },
    'Llama 3.2 90B Instruct': {
      inputTokenPrice: 0.00072,
      outputTokenPrice: 0.00072,
    },
    'Mistral 7B Instruct': {
      inputTokenPrice: 0.00015,
      outputTokenPrice: 0.0002,
    },
    'Mixtral 8x7B Instruct': {
      inputTokenPrice: 0.00045,
      outputTokenPrice: 0.0007,
    },
    'Mistral Small (24.02)': {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.003,
    },
    'Mistral Large (24.02)': {
      inputTokenPrice: 0.004,
      outputTokenPrice: 0.012,
    },
    'Mistral Large (24.07)': {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.006,
    },
    'Jamba-Instruct': {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0007,
    },
    'Jamba 1.5 Large': {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.008,
    },
    'Jamba 1.5 Mini': {
      inputTokenPrice: 0.0002,
      outputTokenPrice: 0.0004,
    },
  },
  imageModelPrices: {
    'Titan Image Generator G1': {
      small: 0.008,
      medium: 0.01,
    },
    'Titan Image Generator G1 v2': {
      small: 0.008,
      medium: 0.01,
    },
    'Nova Canvas': {
      medium: 0.04,
      large: 0.06,
    },
    'SDXL 1.0': {
      medium: 0.04,
    },
    'SD3 Large 1.0': {
      medium: 0.08,
    },
    'Stable Diffusion 3.5 Large': {
      medium: 0.08,
    },
    'Stable Image Core 1.0': {
      medium: 0.04,
    },
    'Stable Image Ultra 1.0': {
      medium: 0.14,
    },
  },
};

interface ModelPriceType {
  textModelPrices: Record<
    string,
    { inputTokenPrice: number; outputTokenPrice: number }
  >;
  imageModelPrices: ImageModelPrices;
}

type ImageModelPrices = {
  'Titan Image Generator G1': {
    small: number;
    medium: number;
  };
  'Titan Image Generator G1 v2': {
    small: number;
    medium: number;
  };
  'Nova Canvas': {
    medium: number;
    large: number;
  };
  'SDXL 1.0': {
    medium: number;
  };
  'SD3 Large 1.0': {
    medium: number;
  };
  'Stable Diffusion 3.5 Large': {
    medium: number;
  };
  'Stable Image Core 1.0': {
    medium: number;
  };
  'Stable Image Ultra 1.0': {
    medium: number;
  };
};

export function getTotalCost(usage: Usage[]) {
  return Number(
    usage
      .filter(modelUsage => getUsagePrice(modelUsage).totalPrice > 0)
      .reduce((sum, model) => sum + getUsagePrice(model).totalPrice, 0)
      .toFixed(2)
  );
}

export function getTotalInputTokens(usage: Usage[]) {
  return usage.reduce((sum, model) => sum + (model.inputTokens || 0), 0);
}

export function getTotalInputPrice(usage: Usage[]) {
  return Number(
    usage
      .filter(modelUsage => getUsagePrice(modelUsage).inputPrice > 0)
      .reduce((sum, model) => sum + getUsagePrice(model).inputPrice, 0)
      .toFixed(6)
  );
}

export function getTotalOutputTokens(usage: Usage[]) {
  return usage.reduce((sum, model) => sum + (model.outputTokens || 0), 0);
}

export function getTotalOutputPrice(usage: Usage[]) {
  return Number(
    usage
      .filter(modelUsage => getUsagePrice(modelUsage).outputPrice > 0)
      .reduce((sum, model) => sum + getUsagePrice(model).outputPrice, 0)
      .toFixed(6)
  );
}

export function getTotalImageCount(usage: Usage[]) {
  return Number(
    usage
      .reduce(
        (sum, model) =>
          sum +
          (model.smallImageCount || 0) +
          (model.imageCount || 0) +
          (model.largeImageCount || 0),
        0
      )
      .toLocaleString()
  );
}

export function getTotalImagePrice(usage: Usage[]) {
  return Number(
    usage
      .reduce(
        (sum, model) =>
          sum +
          (getUsagePrice(model).smallImagePrice || 0) +
          (getUsagePrice(model).mediumImagePrice || 0) +
          (getUsagePrice(model).largeImagePrice || 0),
        0
      )
      .toFixed(6)
  );
}

export function addBedrockPrefixToDeepseekModels(models: Model[]): void {
  for (let i = 0; i < models.length; i++) {
    if (models[i].modelName.toLowerCase().includes('deepseek')) {
      models[i] = {
        ...models[i],
        modelName: `Bedrock ${models[i].modelName}`,
      };
    }
  }
}
