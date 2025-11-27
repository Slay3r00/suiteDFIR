import logging

def setup_logging(log_file="backend.log", level=logging.INFO):
    """Backend logging system"""
    # Create logger
    logger = logging.getLogger()
    logger.setLevel(level)

    # Create file handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(level)

    # Create formatter and set it for the handler
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    file_handler.setFormatter(formatter)

    # Remove any existing handlers
    if logger.hasHandlers():
        logger.handlers.clear()

    # Add file handler to logger
    logger.addHandler(file_handler)

    logging.info("Logging initialized. Output directed to %s", log_file)
