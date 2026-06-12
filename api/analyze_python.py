from flask import Flask, request, jsonify
import sys
import os
import tempfile
from pathlib import Path

# Add project root to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from python_analyzer.main import DatabaseAnalyzer
    from python_analyzer.analyzers.data_generator import generate_test_data
    from python_analyzer.analyzers.schema_converter import SchemaConverter
except ImportError:
    # Fallback to absolute or relative imports if needed
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from python_analyzer.main import DatabaseAnalyzer
    from python_analyzer.analyzers.data_generator import generate_test_data
    from python_analyzer.analyzers.schema_converter import SchemaConverter

app = Flask(__name__)

@app.route('/api/analyze_python', methods=['POST'])
def analyze():
    try:
        # 1. Manejar peticiones JSON (para generación de datos y conversión en Vercel)
        if request.is_json:
            payload = request.get_json()
            action = payload.get('action')
            
            if action == 'generate_data':
                schema = payload.get('schema', {})
                config = payload.get('config', {})
                result = generate_test_data(schema, config)
                return jsonify({'success': True, 'data': result})
                
            elif action == 'convert':
                schema = payload.get('schema', {})
                target_format = payload.get('targetFormat', '').lower()
                
                converter = SchemaConverter()
                result = converter.generate_conversions(schema)
                
                if 'error' in result:
                    return jsonify({'success': False, 'error': result['error']}), 400
                    
                formats = result.get('formats', {})
                fmt = target_format
                if fmt == 'postgresql':
                    fmt = 'postgres'
                    
                converted_code = formats.get(fmt)
                if not converted_code:
                    converted_code = formats.get(target_format)
                    
                if not converted_code:
                    return jsonify({'success': False, 'error': f"Formato no soportado en Python: {target_format}"}), 400
                    
                return jsonify({'success': True, 'convertedCode': converted_code})
            else:
                return jsonify({'success': False, 'error': f"Acción '{action}' no soportada"}), 400

        # 2. Manejar subida de archivos estándar (Análisis de base de datos)
        if 'file' not in request.files:
            return jsonify({'success': False, 'error': 'No se ha subido ningún archivo'}), 400
            
        file = request.files['file']
        if file.filename == '':
            return jsonify({'success': False, 'error': 'Archivo sin nombre'}), 400
            
        # Save uploaded file to a temporary location
        suffix = Path(file.filename).suffix.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            file.save(temp_file.name)
            temp_path = temp_file.name
            
        # Run database analyzer
        analyzer = DatabaseAnalyzer()
        result = analyzer.analyze_file(temp_path)
        
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)

