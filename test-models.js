// Тест моделей из разных провайдеров
const fs = require('fs');

// Читаем ключи
const keysContent = fs.readFileSync('провайдеры и ключи.txt', 'utf-8');

// Извлекаем ключи
const groqKey = keysContent.match(/groq\s+([^\s]+)/)?.[1];
const samanovaKey = keysContent.match(/sambanova\s+([^\s]+)/)?.[1];
const glmKey = keysContent.match(/GLM\s+([^\s]+)/)?.[1];

console.log('🔑 Найденные ключи:');
console.log('Groq:', groqKey ? '✓' : '✗');
console.log('Sambanova:', samanovaKey ? '✓' : '✗');
console.log('GLM:', glmKey ? '✓' : '✗');
console.log('\n');

// Модели для тестирования
const providers = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: groqKey,
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma2-9b-it'
    ]
  },
  {
    name: 'Sambanova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    key: samanovaKey,
    models: [
      'Meta-Llama-3.3-70B-Instruct',
      'DeepSeek-V3.1',
      'DeepSeek-V3.2'
    ]
  },
  {
    name: 'GLM',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    key: glmKey,
    models: [
      'glm-4-flash',
      'glm-4-plus'
    ]
  }
];

async function testModel(provider, model) {
  try {
    const headers = {
      'Authorization': `Bearer ${provider.key}`,
      'Content-Type': 'application/json'
    };

    const body = {
      model: model,
      messages: [
        { role: 'user', content: 'Привет! Ответь кратко: 2+2=?' }
      ],
      max_tokens: 100,
      temperature: 0.5
    };

    const response = await fetch(provider.url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'Нет ответа';
      console.log(`✅ ${provider.name} / ${model}`);
      console.log(`   Ответ: ${answer.substring(0, 50)}...`);
      return { success: true, provider: provider.name, model, answer };
    } else {
      const error = await response.text();
      console.log(`❌ ${provider.name} / ${model}`);
      console.log(`   Ошибка: ${response.status} - ${error.substring(0, 100)}`);
      return { success: false, provider: provider.name, model, error: response.status };
    }
  } catch (error) {
    console.log(`❌ ${provider.name} / ${model}`);
    console.log(`   Ошибка: ${error.message}`);
    return { success: false, provider: provider.name, model, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 Начинаем тестирование моделей...\n');
  
  const results = [];
  
  for (const provider of providers) {
    if (!provider.key) {
      console.log(`⏭️  Пропускаем ${provider.name} (нет ключа)\n`);
      continue;
    }
    
    console.log(`\n📡 Тестируем провайдер: ${provider.name}`);
    console.log('─'.repeat(50));
    
    for (const model of provider.models) {
      const result = await testModel(provider, model);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза между запросами
    }
  }
  
  console.log('\n\n📊 ИТОГОВЫЙ ОТЧЕТ:');
  console.log('═'.repeat(50));
  
  const working = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Работающие модели (${working.length}):`);
  working.forEach(r => {
    console.log(`   • ${r.provider} / ${r.model}`);
  });
  
  console.log(`\n❌ Не работающие модели (${failed.length}):`);
  failed.forEach(r => {
    console.log(`   • ${r.provider} / ${r.model} (${r.error})`);
  });
  
  if (working.length > 0) {
    console.log(`\n\n🎯 РЕКОМЕНДАЦИЯ:`);
    console.log(`Используйте: ${working[0].provider} / ${working[0].model}`);
  } else {
    console.log('\n\n⚠️  Ни одна модель не работает!');
  }
}

runTests().catch(console.error);
