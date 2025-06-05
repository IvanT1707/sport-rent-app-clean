import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.errorBox}>
            <h2 style={styles.heading}>Щось пішло не так 😕</h2>
            <p style={styles.message}>
              {this.state.error?.message || 'Сталася неочікувана помилка'}
            </p>
            {this.state.errorInfo?.componentStack && (
              <details style={styles.details}>
                <summary>Деталі помилки</summary>
                <pre style={styles.stack}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <div style={styles.buttons}>
              <button 
                onClick={this.handleReload}
                style={styles.button}
              >
                Спробувати знову
              </button>
              <button 
                onClick={this.handleGoHome}
                style={{...styles.button, ...styles.secondaryButton}}
              >
                На головну
              </button>
            </div>
          </div>
        </div>
      );
    }


    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    backgroundColor: '#f8f9fa',
  },
  errorBox: {
    maxWidth: '600px',
    padding: '2rem',
    borderRadius: '8px',
    backgroundColor: 'white',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
  },
  heading: {
    color: '#dc3545',
    marginTop: 0,
  },
  message: {
    color: '#6c757d',
    marginBottom: '1.5rem',
  },
  details: {
    margin: '1rem 0',
    textAlign: 'left',
  },
  stack: {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderRadius: '4px',
    overflowX: 'auto',
    fontSize: '0.85rem',
    whiteSpace: 'pre-wrap',
  },
  buttons: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    marginTop: '1.5rem',
  },
  button: {
    padding: '0.5rem 1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
};

export default ErrorBoundary;
