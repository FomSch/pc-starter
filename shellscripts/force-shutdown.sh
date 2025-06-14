#!/bin/bash
gpioset gpiochip0 12=1
sleep 5
gpioset gpiochip0 12=0
