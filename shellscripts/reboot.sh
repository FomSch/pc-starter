#!/bin/bash
gpioset gpiochip0 8=1
sleep 0.5
gpioset gpiochip0 8=0
