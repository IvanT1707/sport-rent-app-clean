import { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Паролі не збігаються');
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Реєстрація успішна");
      navigate('/login');
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <>
      <Header />
      <main className="payment-form">
        <h2 style={{ textAlign: 'center' }}>Реєстрація</h2>
        <form onSubmit={handleRegister}>
          <input
            type="email"
            placeholder="Email"
            required
            onChange={e => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Пароль"
            required
            onChange={e => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Підтвердіть пароль"
            required
            onChange={e => setConfirmPassword(e.target.value)}
          />
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="hero-button">Зареєструватися</button>
        </form>
        <p style={{ marginTop: '15px', textAlign: 'center' }}>
          Вже зареєстрований? <Link to="/login">Заходь</Link>
        </p>
      </main>
      <Footer />
    </>
  );
};

export default Register;
