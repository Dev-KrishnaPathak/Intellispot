export default function errorHandler(err, _req, res, _next) { // eslint-disable-line
  console.error(err); 
  res.status(err.status || 500).json({ message: err.message || 'Server Error' });
}
